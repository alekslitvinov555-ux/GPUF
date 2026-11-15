"""Which country each 0.5 degree cell belongs to (Natural Earth admin-0).

Used for the "max per country" diversity cap and for place labels. The label's
nearest town can sit across a border from the cell itself; the polygon test
does not. A cell takes the country whose polygon contains its centre; coastal
cells whose centre falls in the sea get the country of the nearest land cell
within two cells.

Natural Earth 1:50m Admin 0 - Countries (public domain), cached in
``cache/raw/ne_50m_admin_0_countries.geojson`` (committed, so this works offline).
"""

from __future__ import annotations

import json
from functools import lru_cache

import numpy as np
from scipy.ndimage import distance_transform_edt

from src.acquire.download import REPO_ROOT

URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/"
    "geojson/ne_50m_admin_0_countries.geojson"
)
FILENAME = "ne_50m_admin_0_countries.geojson"
NROW, NCOL = 360, 720
REACH = 2  # cells: how far a sea-centred coastal cell looks for its country


def _rasterize(features: list[dict]) -> np.ndarray:
    """Assign cell centers using an even–odd scanline for each polygon and its holes."""
    ids = np.zeros((NROW, NCOL), dtype=np.int32)
    longitudes = -180.0 + (np.arange(NCOL) + 0.5) * 0.5
    latitudes = 90.0 - (np.arange(NROW) + 0.5) * 0.5
    for index, feature in enumerate(features, start=1):
        geometry = feature.get("geometry")
        if not geometry or geometry["type"] not in {"Polygon", "MultiPolygon"}:
            continue
        polygons = geometry["coordinates"]
        if geometry["type"] == "Polygon":
            polygons = [polygons]
        for polygon in polygons:
            rings = [np.asarray(ring, dtype=float)[:, :2] for ring in polygon]
            if not rings:
                continue
            outer = rings[0]
            rows = np.flatnonzero(
                (latitudes >= outer[:, 1].min()) & (latitudes <= outer[:, 1].max())
            )
            for row in rows:
                y = latitudes[row]
                fill = np.zeros(NCOL, dtype=bool)
                for ring in rings:
                    start, end = ring[:-1], ring[1:]
                    crossing = (start[:, 1] > y) != (end[:, 1] > y)
                    a, b = start[crossing], end[crossing]
                    intersections = a[:, 0] + (y - a[:, 1]) * (b[:, 0] - a[:, 0]) / (
                        b[:, 1] - a[:, 1]
                    )
                    fill ^= np.searchsorted(np.sort(intersections), longitudes) % 2 == 1
                ids[row, fill] = index
    return ids


@lru_cache(maxsize=4)
def grid(offline: bool | None = None, *, fill_coastal: bool = True) -> tuple[np.ndarray, tuple[str, ...]]:
    """(ids, names): ids[row, col] indexes names; 0 means no country."""
    boundary = REPO_ROOT / "cache" / "raw" / FILENAME
    if not boundary.is_file():
        boundary = REPO_ROOT / "data" / "country-boundaries.geojson"
    features = json.loads(boundary.read_text(encoding="utf-8"))["features"]
    names = [
        "",
        *(str(f["properties"].get("NAME") or f["properties"].get("ADMIN")) for f in features),
    ]
    ids = _rasterize(features)
    if not fill_coastal:
        return ids, tuple(names)
    # Coastal cells: borrow the nearest country within REACH cells.
    distance, (ri, ci) = distance_transform_edt(ids == 0, return_indices=True)
    filled = np.where((ids == 0) & (distance <= REACH), ids[ri, ci], ids)
    return filled.astype(np.int32), tuple(names)


def country_at(lat: float, lon: float, offline: bool | None = None) -> str | None:
    ids, names = grid(offline)
    row = min(max(int((90.0 - lat) // 0.5), 0), NROW - 1)
    col = min(max(int((lon + 180.0) // 0.5), 0), NCOL - 1)
    index = int(ids[row, col])
    return names[index] or None
