"""Derive a reproducible pilot Jezero profile from NASA PDS MEDA CSVs."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import pandas as pd

BASE = "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_calibrated_env/sol_0000_0089"
SOLS = (40, 42, 43, 46)

def load(directory, sol, kind):
    label = next(directory.glob(f"pds-WE__{sol:04d}*CAL_{kind}*.xml"))
    xml = ET.parse(label)
    file = xml.findtext(".//{*}File/{*}file_name")
    size = int(xml.findtext(".//{*}File/{*}file_size"))
    candidates = (directory / ("pds-" + file), directory / ("verified-" + file))
    csv = next(path for path in candidates if path.is_file() and path.stat().st_size == size)
    frame = pd.read_csv(csv)
    records = int(xml.findtext(".//{*}Table_Delimited/{*}records"))
    if len(frame) != records:
        raise ValueError(f"{file}: expected {records} records")
    url = f"{BASE}/sol_{sol:04d}/{file}"
    return frame, {"sol": sol, "csv": url, "label": url[:-4]+".xml",
                   "records": records, "sha256": hashlib.sha256(csv.read_bytes()).hexdigest()}

def by_hour(frame, column, lower, upper):
    hour = pd.to_numeric(frame.LMST.str.extract(r"^\d+M(\d\d):")[0], errors="coerce")
    value = pd.to_numeric(frame[column], errors="coerce")
    valid = hour.between(0, 23) & value.between(lower, upper)
    return value[valid].groupby(hour[valid].astype(int)).agg(["mean", "count"])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    hourly, sources = [], []
    for sol in SOLS:
        frame, source = load(args.directory, sol, "ATS")
        bins = by_hour(frame, "ATS_LOCAL_TEMP1", 100, 350)
        hourly.append(bins["mean"].rename(sol))
        sources.append(source)
    table = pd.concat(hourly, axis=1).reindex(range(24))
    if table.isna().all(axis=1).any():
        raise ValueError("Composite must cover all 24 LMST hours")
    cycle = table.mean(axis=1) - 273.15
    pressure, pressure_source = load(args.directory, 46, "PS_")
    nominal = pressure[pressure.PRESSURE_MEASUREMENT_MODE.eq("nominal")]
    pressure_bins = by_hour(nominal, "BAROCAP1_PRESSURE", 300, 1200)
    result = {
        "airTemperatureC": round(float(cycle.mean()), 3),
        "airTemperatureRangeC": round(float(cycle.max() - cycle.min()), 3),
        "hourlyTemperatureC": cycle.round(4).tolist(),
        "solsPerHour": table.count(axis=1).tolist(),
        "pressurePa": round(float(pressure_bins["mean"].mean()), 2),
        "pressureHours": len(pressure_bins),
        "temperatureSols": list(SOLS),
        "pressureSol": 46,
        "method": "ATS_LOCAL_TEMP1 (mast). Filter missing/nonphysical readings (100–350 K). For each sampled sol, average samples in each local mean solar hour; average each hour equally across sols with observations. Mean and range are calculated across the 24 composite hourly means. Pressure uses nominal BAROCAP1 observations (300–1200 Pa) and averages available hourly means on sol 46.",
        "products": sources + [pressure_source]
    }
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(result["airTemperatureC"], result["airTemperatureRangeC"], result["pressurePa"], result["pressureHours"])

if __name__ == "__main__":
    main()
