"""
Global Planetary Analog Finder — Team PANEM_U, NASA Space Apps Challenge 2026.
SI disclosure: this code was drafted with the help of an SI assistant (Claude, by Anthropic)
and reviewed, run and tested by the team.

Step 1 — download global climatology from the NASA POWER API.

NASA POWER (https://power.larc.nasa.gov) serves 25-year (2001–2025) climatologies
built from MERRA-2 reanalysis and CERES satellite data. No account or API key needed.

The "regional" endpoint allows 1 parameter and a 10°×10° box per request, so we tile
the globe: 18 latitude bands × 36 longitude bands = 648 tiles per parameter.
The climatology endpoint is rate-limited (about 30 requests per minute), so requests are
sent one by one with a pause (~23/min). To save time we first download topsoil wetness
(GWETTOP = 1.0 over the ocean) and then skip tiles that contain no land.
Every tile is cached in data/raw/, so if the script stops you can just run it again
and it continues where it left off.

Usage:
    python 1_download_data.py              # full globe (~1.5–2 h because of the rate limit)
    python 1_download_data.py --test       # 4 tiles per parameter, ~30 s, to check that everything works
"""
import argparse
import glob
import sys as _sys
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = "https://power.larc.nasa.gov/api/temporal/climatology/regional"
PARAMS = [
    "PRECTOTCORR",     # precipitation, mm/day
    "GWETTOP",         # topsoil wetness, 0-1 (1.0 over ocean)
    "RH2M",            # relative humidity, %
    "T2M",             # mean air temperature, °C (monthly values -> seasonal swing)
    "T2M_MIN",         # minimum air temperature, °C
    "T2M_RANGE",       # day-night temperature range, °C
    "ALLSKY_SRF_ALB",  # surface albedo (CERES, 1° grid)
    "WS10M",           # wind speed at 10 m, m/s
    "FROST_DAYS",      # frost days
    "PS",              # surface pressure, kPa -> elevation
]
for _s in (_sys.stdout, _sys.stderr):  # avoid UnicodeEncodeError in Windows consoles
    try:
        _s.reconfigure(errors="replace")
    except Exception:
        pass
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")


def tiles(test=False):
    if test:  # Atacama, Sahara, Ukraine, Antarctica
        return [(-30, -75), (20, 0), (40, 30), (-80, 160)]
    return [(la, lo) for la in range(-90, 90, 10) for lo in range(-180, 180, 10)]


def fetch(param, la, lo, retries=5):
    path = os.path.join(RAW, param, f"{la}_{lo}.json")
    if os.path.exists(path) and os.path.getsize(path) > 50:
        return "cached"
    url = (f"{BASE}?parameters={param}&community=AG&format=JSON"
           f"&latitude-min={la}&latitude-max={la + 10}"
           f"&longitude-min={lo}&longitude-max={lo + 10}")
    delay = 2
    attempt = 0
    while attempt < retries:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SpaceApps2026-PANEM_U-analog-finder"})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.loads(r.read().decode("utf-8"))
            feats = data.get("features", [])
            slim = []
            for f in feats:
                lon, lat = f["geometry"]["coordinates"][:2]
                v = f["properties"]["parameter"][param]
                slim.append([lat, lon, v.get("ANN"), [v.get(m) for m in
                             ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")]])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as fh:
                json.dump(slim, fh)
            return f"ok ({len(slim)} pts)"
        except urllib.error.HTTPError as e:
            if e.code == 422:  # request the API refuses (e.g. box outside the grid) -> store empty tile
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, "w") as fh:
                    json.dump([], fh)
                return "empty (422)"
            if e.code == 429:  # NASA POWER rate limit: wait politely, do not count as a failed attempt
                print("    rate limit reached (HTTP 429) - pausing 5 minutes...")
                time.sleep(300)
                continue
            err = f"HTTP {e.code}"
        except Exception as e:  # network hiccup, timeout, rate limit
            err = str(e)[:80]
        attempt += 1
        time.sleep(delay)
        delay *= 2
    return f"FAILED: {err}"


GAP_S = 2.6  # seconds between requests (~23 per minute, under the ~30/min limit)


def land_tiles():
    """Tiles whose GWETTOP data contain at least one land cell (wetness < 0.995)."""
    keep = set()
    for path in glob.glob(os.path.join(RAW, "GWETTOP", "*.json")):
        la, lo = map(int, os.path.basename(path)[:-5].split("_"))
        with open(path) as fh:
            if any(v is not None and v < 0.995 for _, _, v, _ in json.load(fh)):
                keep.add((la, lo))
    return keep


def run(jobs):
    t0, failed = time.time(), []
    for n, (p, la, lo) in enumerate(jobs, 1):
        res = fetch(p, la, lo)
        if res.startswith("FAILED"):
            failed.append((p, la, lo))
        if res != "cached":
            time.sleep(GAP_S)
        if n % 25 == 0 or n == len(jobs) or res.startswith("FAILED"):
            el = time.time() - t0
            print(f"  {n}/{len(jobs)}  {p} {la},{lo} -> {res}   elapsed {el/60:.1f} min, ETA {el/n*(len(jobs)-n)/60:.1f} min")
    return failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="download only 4 tiles per parameter")
    args = ap.parse_args()
    tl = tiles(args.test)

    print("Phase 1/2: topsoil wetness (used as a land/ocean mask)")
    failed = run([("GWETTOP", la, lo) for (la, lo) in tl])

    land = land_tiles()
    keep = [(la, lo) for (la, lo) in tl
            if (la, lo) in land or la < -60 or (la >= 50 and -80 <= lo < -10)]  # + Antarctica, Greenland (ice)
    print(f"\nPhase 2/2: other parameters for {len(keep)} tiles that contain land "
          f"({len(tl) - len(keep)} ocean-only tiles skipped)")
    failed += run([(p, la, lo) for p in PARAMS if p != "GWETTOP" for (la, lo) in keep])

    if failed:
        print(f"\n{len(failed)} tiles failed. Just run the script again — finished tiles are cached.")
        sys.exit(1)
    print("\nAll tiles downloaded. Next: python 2_build_dataset.py" + (" --test" if args.test else ""))


if __name__ == "__main__":
    main()
