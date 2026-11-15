"""
Global Planetary Analog Finder — Team PANEM_U, NASA Space Apps Challenge 2026.
SI disclosure: this code was drafted with the help of an SI assistant (Claude, by Anthropic)
and reviewed, run and tested by the team.

Step 2 — build the analog dataset and the web map data.

Reads the NASA POWER tiles from data/raw/, builds one table of environmental
features for every land grid cell on Earth (~0.5° × 0.625°), scores each cell
against every Moon/Mars target profile in config.json, validates the method
against well-known analog sites and finds "hidden gem" candidates.

Outputs:
    web/data.js                      -> data for the interactive map (open web/index.html)
    outputs/earth_features.csv       -> full feature table
    outputs/hidden_gems_<profile>.csv
    outputs/validation_report.txt

Usage:
    python 2_build_dataset.py            # after the full download
    python 2_build_dataset.py --test     # after "1_download_data.py --test"
    python 2_build_dataset.py --names    # also look up place names for hidden gems (OpenStreetMap, ~1 s each)
"""
import argparse
import sys as _sys
import glob
import json
import math
import os
import time
import urllib.parse
import urllib.request

import numpy as np
import pandas as pd

for _s in (_sys.stdout, _sys.stderr):  # avoid UnicodeEncodeError in Windows consoles
    try:
        _s.reconfigure(errors="replace")
    except Exception:
        pass
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
OUT = os.path.join(HERE, "outputs")
WEB = os.path.join(HERE, "web")

SIGMA = 0.25           # tolerance of the match function, in percentile units
GEM_SPACING_KM = 400   # hidden gems must be at least this far apart
NOVELTY_KM = 300       # ...and at least this far from any well-known analog site
N_GEMS = 12

FEATURE_PARAM = {
    "precip": "PRECTOTCORR", "soil": "GWETTOP", "rh": "RH2M", "tmean": "T2M",
    "tmin": "T2M_MIN", "diurnal": "T2M_RANGE", "albedo": "ALLSKY_SRF_ALB",
    "wind": "WS10M", "frost": "FROST_DAYS",
}


# ----------------------------------------------------------------------------- loading
def load_param(param):
    rows = []
    for path in glob.glob(os.path.join(RAW, param, "*.json")):
        with open(path) as fh:
            for lat, lon, ann, months in json.load(fh):
                rows.append((lat, lon, ann, months))
    if not rows:
        raise SystemExit(f"No data for {param}. Run 1_download_data.py first.")
    df = pd.DataFrame(rows, columns=["lat", "lon", "ann", "months"])
    df["lon"] = df["lon"].where(df["lon"] < 180, df["lon"] - 360)
    df["lat"] = df["lat"].round(4)
    df["lon"] = df["lon"].round(4)
    df = df.drop_duplicates(["lat", "lon"])
    df.loc[df["ann"] <= -998, "ann"] = np.nan
    return df


def build_table():
    base = None
    for feat, param in FEATURE_PARAM.items():
        if feat == "albedo":
            continue
        d = load_param(param)
        col = d[["lat", "lon", "ann"]].rename(columns={"ann": feat})
        if feat == "tmean":
            m = np.array([[np.nan if (x is None or x <= -998) else x for x in ms] for ms in d["months"]], dtype=float)
            col["seasonal"] = np.nanmax(m, axis=1) - np.nanmin(m, axis=1)
        base = col if base is None else base.merge(col, on=["lat", "lon"], how="outer")

    ps = load_param("PS")[["lat", "lon", "ann"]].rename(columns={"ann": "ps"})
    base = base.merge(ps, on=["lat", "lon"], how="left")
    # barometric formula: surface pressure (kPa) -> approximate elevation (m)
    base["elev"] = 44330.8 * (1 - (base["ps"] / 101.325) ** 0.190263)

    # albedo comes on a 1° grid (cell centres at x.5) -> attach to the nearest 1° cell
    alb = load_param("ALLSKY_SRF_ALB")[["lat", "lon", "ann"]].rename(columns={"ann": "albedo"})
    alb["key"] = list(zip(np.floor(alb["lat"]).astype(int), np.floor(alb["lon"]).astype(int)))
    amap = dict(zip(alb["key"], alb["albedo"]))
    keys = zip(np.clip(np.floor(base["lat"]), -90, 89).astype(int), np.clip(np.floor(base["lon"]), -180, 179).astype(int))
    base["albedo"] = [amap.get(k, np.nan) for k in keys]
    return base


def land_mask(df):
    try:
        from global_land_mask import globe
        m = globe.is_land(df["lat"].to_numpy(), df["lon"].to_numpy())
        print("Land mask: global-land-mask package")
        return m
    except ImportError:
        print("Land mask: heuristic (pip install global-land-mask for a cleaner coastline)")
        return ((df["soil"] < 0.995) | (df["elev"] > 100)).to_numpy()


def exclude_russia(df):
    # Natural Earth Admin-0 (Ukraine point of view), sampled at POWER grid centres.
    with open(os.path.join(HERE, "data", "excluded-grid.json"), encoding="utf-8") as fh:
        rows = json.load(fh)
    excluded = set()
    for lat_index, edges in rows.items():
        for start, end in zip(edges[::2], edges[1::2]):
            excluded.update((int(lat_index), column) for column in range(start, end))
    lat_indices = (df["lat"] * 2).round().astype(int)
    lon_indices = ((df["lon"] + 180) / 0.625).round().astype(int) % 576
    keep = [(lat, lon) not in excluded for lat, lon in zip(lat_indices, lon_indices)]
    return df.loc[keep].copy()


# ----------------------------------------------------------------------------- scoring
def area_weights(df):
    # grid cells shrink towards the poles: weight each cell by cos(latitude) = its relative area
    return np.cos(np.radians(df["lat"].to_numpy())) + 1e-6


def weighted_pct(values, w):
    """Area-weighted percentile rank (0..1) of each value; NaN stays NaN. Ties share the mid-rank."""
    values = np.asarray(values, dtype=float)
    out = np.full(len(values), np.nan)
    ok = ~np.isnan(values)
    v, ww = values[ok], w[ok]
    s = pd.DataFrame({"v": v, "w": ww}).groupby("v")["w"].sum().sort_index()
    cum = s.cumsum() - s / 2
    out[ok] = (cum / ww.sum()).reindex(v).to_numpy()
    return out


def percentile_ranks(df, features):
    w = area_weights(df)
    return {f: weighted_pct(df[f].to_numpy(), w) for f in features}


def target_pct(df, feat, tgt):
    if "pct" in tgt:
        return tgt["pct"]
    v = df[feat].to_numpy()
    w = area_weights(df)
    ok = ~np.isnan(v)
    return float(w[ok][v[ok] <= tgt["value"]].sum() / w[ok].sum())


def score_profile(df, pct, prof):
    num = np.zeros(len(df))
    available_only = prof.get("missingPolicy") == "available"
    den = np.zeros(len(df))
    per_feat = {}
    for feat, tgt in prof["targets"].items():
        if "tolerance" in tgt:
            distance = (df[feat].to_numpy() - tgt["value"]) / tgt["tolerance"]
        else:
            distance = (pct[feat] - target_pct(df, feat, tgt)) / SIGMA
        available = np.isfinite(distance)
        m = np.where(available, np.exp(-(distance ** 2)), 0.0 if available_only else 0.5)
        per_feat[feat] = m
        num += tgt["w"] * m
        den += tgt["w"] * available if available_only else tgt["w"]
    score = np.divide(num, den, out=np.full(len(df), np.nan), where=den > 0)
    return score, per_feat


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(a))


def nearest_cell(df, lat, lon):
    d = haversine_km(lat, lon, df["lat"].to_numpy(), df["lon"].to_numpy())
    i = int(np.argmin(d))
    return i, float(d[i])


def hidden_gems(df, score, known):
    order = np.argsort(-score)
    order = order[np.isfinite(score[order])]
    lats, lons = df["lat"].to_numpy(), df["lon"].to_numpy()
    klat = np.array([k["lat"] for k in known])
    klon = np.array([k["lon"] for k in known])
    picked = []
    for i in order:
        if len(picked) >= N_GEMS:
            break
        if np.min(haversine_km(lats[i], lons[i], klat, klon)) < NOVELTY_KM:
            continue
        if picked and np.min(haversine_km(lats[i], lons[i], lats[picked], lons[picked])) < GEM_SPACING_KM:
            continue
        picked.append(i)
    return picked


def place_name(lat, lon):
    url = "https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode(
        {"lat": lat, "lon": lon, "format": "json", "zoom": 6, "accept-language": "en"})
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SpaceApps2026-PANEM_U-analog-finder"})
        with urllib.request.urlopen(req, timeout=20) as r:
            j = json.loads(r.read().decode("utf-8"))
        a = j.get("address", {})
        parts = [a.get("state") or a.get("region") or a.get("county"), a.get("country")]
        return ", ".join(p for p in parts if p) or j.get("display_name", "")
    except Exception:
        return ""


# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true")
    ap.add_argument("--names", action="store_true", help="reverse-geocode hidden gems via OpenStreetMap")
    args = ap.parse_args()

    with open(os.path.join(HERE, "config.json"), encoding="utf-8") as fh:
        cfg = json.load(fh)
    features = list(cfg["features"].keys())

    df = build_table()
    df = exclude_russia(df[land_mask(df)])
    df = df.dropna(subset=["precip", "tmean"]).reset_index(drop=True)
    print(f"Land cells: {len(df):,}")

    pct = percentile_ranks(df, features)
    os.makedirs(OUT, exist_ok=True)

    comparison_area = "sampled land" if args.test else "eligible land"
    report = ["GLOBAL PLANETARY ANALOG FINDER — validation report", "=" * 60, ""]
    gems_out = {}
    if args.test:
        report += ["TEST MODE: four regions only. Percentiles are relative to the sample.", ""]
    for pid, prof in cfg["profiles"].items():
        score, _ = score_profile(df, pct, prof)
        df[f"score_{pid}"] = score
        score_pct = weighted_pct(score, area_weights(df))

        report.append(f"{prof['name']}")
        tagged = [k for k in cfg["known_analogs"] if pid in k["profiles"]]
        ranks = []
        for k in tagged:
            i, dist = nearest_cell(df, k["lat"], k["lon"])
            if dist > 150:
                report.append(f"   - {k['name']:<45} no land cell within 150 km (skipped)")
                continue
            ranks.append(score_pct[i])
            report.append(f"   - {k['name']:<45} score {score[i]:.2f}  -> top {100 * (1 - score_pct[i]):5.1f}% of {comparison_area}")
        if ranks:
            report.append(f"   => median known analog is in the top {100 * (1 - np.median(ranks)):.1f}% of land cells "
                          f"(random would be ~50%)")
        report.append("")

        picks = hidden_gems(df, score, cfg["known_analogs"])
        rows = []
        for rank, i in enumerate(picks, 1):
            name = place_name(df.at[i, "lat"], df.at[i, "lon"]) if args.names else ""
            if args.names:
                time.sleep(1.1)  # OpenStreetMap usage policy: max 1 request per second
            row = {"rank": rank, "lat": df.at[i, "lat"], "lon": df.at[i, "lon"], "place": name,
                   "score": round(float(score[i]), 3), "top_percent": round(100 * (1 - score_pct[i]), 2)}
            row.update({f: round(float(df.at[i, f]), 2) for f in features})
            rows.append(row)
        gdf = pd.DataFrame(rows)
        gdf.to_csv(os.path.join(OUT, f"hidden_gems_{pid}.csv"), index=False)
        gems_out[pid] = rows
        print(f"\n{prof['name']} — top hidden gems:")
        print(gdf[["rank", "lat", "lon", "place", "score", "top_percent"]].head(8).to_string(index=False))

    with open(os.path.join(OUT, "validation_report.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(report))
    print("\n" + "\n".join(report))

    df[["lat", "lon"] + features + [c for c in df.columns if c.startswith("score_")]].round(3).to_csv(
        os.path.join(OUT, "earth_features.csv"), index=False)

    # ---- compact export for the web map (scores are recomputed live in the browser)
    scale = {"precip": 100, "soil": 1000, "rh": 10, "tmean": 100, "tmin": 10, "diurnal": 100,
             "seasonal": 10, "albedo": 1000, "wind": 100, "frost": 10, "elev": 1, "ps": 100}
    payload = {
        "grid": {"dlat": 0.5, "dlon": 0.625},
        "lat": (df["lat"] * 2).round().astype(int).tolist(),          # lat * 2
        "lon": (df["lon"] / 0.625).round().astype(int).tolist(),      # lon / 0.625
        "scale": scale,
        "values": {f: [None if pd.isna(v) else int(round(v * scale[f])) for v in df[f]] for f in features},
        "config": cfg,
        "sigma": SIGMA, "gem_spacing_km": GEM_SPACING_KM, "novelty_km": NOVELTY_KM, "n_gems": N_GEMS,
        "gem_names": {pid: {f"{r['lat']:g},{r['lon']:g}": r["place"] for r in rows if r["place"]}
                      for pid, rows in gems_out.items()},
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "test_mode": bool(args.test),
    }
    os.makedirs(WEB, exist_ok=True)
    with open(os.path.join(WEB, "data.js"), "w", encoding="utf-8") as fh:
        fh.write("window.ANALOG_DATA=")
        json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
        fh.write(";")
    size = os.path.getsize(os.path.join(WEB, "data.js")) / 1e6
    print(f"\nWrote web/data.js ({size:.1f} MB). Open web/index.html in your browser.")


if __name__ == "__main__":
    main()
