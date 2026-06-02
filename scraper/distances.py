"""Driving distance calculator using OSRM public demo server.

Caches results in data/distance_cache.json by a ~1km lat/lng grid so we
don't re-query the same area across runs.
"""
from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Iterable

import requests

OSRM_BASE = "https://router.project-osrm.org"
RIDGEWOOD = (40.7048, -73.9027)  # Ridgewood, Queens, NY 11385
METERS_PER_MILE = 1609.344
GRID_DECIMALS = 2  # ~1.1km cell
HAVERSINE_CANDIDATES = 3  # OSRM-route only the N nearest resorts by straight-line
REQUEST_SLEEP_S = 0.15  # courtesy delay for the public OSRM demo


def grid_key(lat: float, lng: float) -> str:
    return f"{round(lat, GRID_DECIMALS)},{round(lng, GRID_DECIMALS)}"


def haversine_miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1 = math.radians(a[0]), math.radians(a[1])
    lat2, lng2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * 3958.7613 * math.asin(math.sqrt(h))


def osrm_route(origin: tuple[float, float], dest: tuple[float, float]) -> tuple[float, float] | None:
    """Returns (miles, hours) or None on failure."""
    url = (
        f"{OSRM_BASE}/route/v1/driving/"
        f"{origin[1]},{origin[0]};{dest[1]},{dest[0]}?overview=false"
    )
    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        data = r.json()
        route = data.get("routes", [{}])[0]
        distance_m = route.get("distance")
        duration_s = route.get("duration")
        if distance_m is None or duration_s is None:
            return None
        return distance_m / METERS_PER_MILE, duration_s / 3600.0
    except (requests.RequestException, ValueError, KeyError, IndexError):
        return None
    finally:
        time.sleep(REQUEST_SLEEP_S)


class DistanceCache:
    def __init__(self, path: Path):
        self.path = path
        self.data: dict = {}
        if path.exists():
            try:
                self.data = json.loads(path.read_text())
            except json.JSONDecodeError:
                self.data = {}

    def get(self, key: str) -> dict | None:
        return self.data.get(key)

    def put(self, key: str, value: dict) -> None:
        self.data[key] = value

    def save(self) -> None:
        self.path.write_text(json.dumps(self.data, indent=2, sort_keys=True))


def compute_distances(
    lat: float,
    lng: float,
    resorts: list[dict],
    cache: DistanceCache,
) -> dict | None:
    """Returns {ridgewoodMiles, ridgewoodHours, skiMiles, skiHours, skiName} or None.

    Recomputes any missing fields against the current RIDGEWOOD / resorts list
    — so changing the destination invalidates that half of the cache only.
    """
    key = grid_key(lat, lng)
    cached = dict(cache.get(key) or {})
    origin = (lat, lng)

    if "ridgewoodMiles" not in cached or "ridgewoodHours" not in cached:
        rw = osrm_route(origin, RIDGEWOOD)
        if rw is None:
            return None
        cached["ridgewoodMiles"] = round(rw[0], 1)
        cached["ridgewoodHours"] = round(rw[1], 2)

    if "skiMiles" not in cached or "skiName" not in cached:
        by_havers = sorted(
            resorts,
            key=lambda r: haversine_miles(origin, (r["lat"], r["lng"])),
        )[:HAVERSINE_CANDIDATES]

        best: tuple[float, float, str] | None = None
        for r in by_havers:
            result = osrm_route(origin, (r["lat"], r["lng"]))
            if result is None:
                continue
            miles, hours = result
            if best is None or miles < best[0]:
                best = (miles, hours, r["name"])

        if best is None:
            return None

        cached["skiMiles"] = round(best[0], 1)
        cached["skiHours"] = round(best[1], 2)
        cached["skiName"] = best[2]

    cache.put(key, cached)
    return cached
