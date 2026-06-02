"""Scrape Redfin for ≤$200k properties on ≥2 acres in NY/VT/NH/ME/MA/RI.

Writes data/listings.json with driving-distance to Ridgewood NJ and the
nearest of ~50 NE ski resorts attached to each listing.

Redfin's autocomplete API is blocked by their CloudFront WAF for direct
requests, but the gis-csv listings endpoint works once we warm up a
session by hitting the homepage. State-level region IDs aren't queryable
either, so we extract per-county region IDs from each state's landing
page HTML and query gis-csv per county.

Run locally:
    pip install -r scraper/requirements.txt
    python scraper/scrape.py
"""
from __future__ import annotations

import csv
import datetime
import io
import json
import re
import sys
import time
from pathlib import Path

import requests

from distances import DistanceCache, compute_distances

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

STATE_SLUGS = {
    "NY": "New-York",
    "VT": "Vermont",
    "NH": "New-Hampshire",
    "ME": "Maine",
    "MA": "Massachusetts",
    "RI": "Rhode-Island",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.redfin.com/",
}

PRICE_CAP = 100_000
MIN_ACRES = 2
SQFT_PER_ACRE = 43560
REGION_TYPE_COUNTY = 5  # Redfin uses region_type=5 for counties / sub-state markets


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    # Warm up: a homepage hit issues the cookies the gis-csv endpoint expects.
    s.get("https://www.redfin.com/", timeout=20)
    return s


def extract_region_ids(session: requests.Session, state_slug: str) -> list[int]:
    """Return all county-level region IDs (region_type=5) listed on the state landing page."""
    r = session.get(f"https://www.redfin.com/state/{state_slug}", timeout=20)
    r.raise_for_status()
    ids: set[int] = set()
    for m in re.finditer(r"region_id=(\d+)[^a-zA-Z]+[^&\"']*region_type=5", r.text):
        ids.add(int(m.group(1)))
    for m in re.finditer(r"region_type=5[^a-zA-Z]+[^&\"']*region_id=(\d+)", r.text):
        ids.add(int(m.group(1)))
    return sorted(ids)


def fetch_listings_csv(
    session: requests.Session,
    region_id: int,
    region_type: int = REGION_TYPE_COUNTY,
) -> list[dict]:
    # Note: Redfin's gis-csv ignores lot-size URL filters; we apply MIN_ACRES
    # client-side in parse_row.
    url = "https://www.redfin.com/stingray/api/gis-csv"
    params = {
        "al": "1",
        "include_pending_homes": "false",
        "max_price": str(PRICE_CAP),
        "num_homes": "350",
        "ord": "redfin-recommended-asc",
        "page_number": "1",
        "region_id": str(region_id),
        "region_type": str(region_type),
        "sf": "1,2,3,5,6,7",
        "start": "0",
        "status": "9",
        "uipt": "1,5,6,7",
        "v": "8",
    }
    r = session.get(url, params=params, timeout=30)
    r.raise_for_status()
    reader = csv.DictReader(io.StringIO(r.text))
    rows = []
    for row in reader:
        # First "row" is sometimes an MLS disclaimer with no real address.
        if not row.get("ADDRESS") and not row.get("LATITUDE"):
            continue
        rows.append(row)
    return rows


def _to_float(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _to_int(v) -> int | None:
    f = _to_float(v)
    return int(f) if f is not None else None


def parse_row(row: dict) -> dict | None:
    lat = _to_float(row.get("LATITUDE"))
    lng = _to_float(row.get("LONGITUDE"))
    price = _to_int(row.get("PRICE"))
    if lat is None or lng is None or price is None:
        return None

    lot_sqft = _to_float(row.get("LOT SIZE"))
    acres = round(lot_sqft / SQFT_PER_ACRE, 2) if lot_sqft else None

    # Client-side acreage filter: Redfin's URL filter is silently ignored.
    if acres is None or acres < MIN_ACRES:
        return None

    prop_type = (row.get("PROPERTY TYPE") or "").strip()
    is_land = "land" in prop_type.lower()

    url_field = next(
        (row[k] for k in row.keys() if k and k.startswith("URL")),
        None,
    )
    url = (
        f"https://www.redfin.com{url_field}"
        if url_field and url_field.startswith("/")
        else url_field
    )

    return {
        "address": row.get("ADDRESS"),
        "city": row.get("CITY"),
        "state": row.get("STATE OR PROVINCE"),
        "zip": row.get("ZIP OR POSTAL CODE"),
        "price": price,
        "beds": _to_float(row.get("BEDS")),
        "baths": _to_float(row.get("BATHS")),
        "sqft": _to_int(row.get("SQUARE FEET")),
        "lotAcres": acres,
        "yearBuilt": _to_int(row.get("YEAR BUILT")),
        "propertyType": prop_type,
        "isLand": is_land,
        "lat": lat,
        "lng": lng,
        "url": url,
        "source": "redfin",
        "mlsId": row.get("MLS#"),
    }


def main() -> int:
    resorts = json.loads((DATA_DIR / "resorts.json").read_text())
    cache = DistanceCache(DATA_DIR / "distance_cache.json")
    session = make_session()

    all_listings: list[dict] = []
    state_summary: dict[str, int] = {}

    for code, slug in STATE_SLUGS.items():
        print(f"=== {code} ({slug}) ===", flush=True)
        try:
            region_ids = extract_region_ids(session, slug)
        except requests.RequestException as e:
            print(f"  state page fetch failed: {e}", flush=True)
            continue
        print(f"  {len(region_ids)} county/market regions", flush=True)
        if not region_ids:
            continue

        state_count = 0
        for rid in region_ids:
            try:
                rows = fetch_listings_csv(session, rid)
            except requests.RequestException as e:
                print(f"  region {rid}: csv fetch failed: {e}", flush=True)
                continue
            for row in rows:
                parsed = parse_row(row)
                if parsed is None:
                    continue
                dist = compute_distances(parsed["lat"], parsed["lng"], resorts, cache)
                if dist is None:
                    continue
                parsed.update(dist)
                all_listings.append(parsed)
                state_count += 1
            time.sleep(0.5)
        state_summary[code] = state_count
        cache.save()
        print(f"  kept {state_count} listings", flush=True)
        time.sleep(1)

    # Dedupe by URL (a property may show in adjacent county queries)
    seen: set = set()
    deduped: list[dict] = []
    for l in all_listings:
        k = l.get("url") or (l.get("address"), l.get("zip"))
        if k in seen:
            continue
        seen.add(k)
        deduped.append(l)

    output = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "count": len(deduped),
        "perState": state_summary,
        "filters": {
            "maxPrice": PRICE_CAP,
            "minAcres": MIN_ACRES,
            "states": list(STATE_SLUGS.keys()),
            "propertyTypes": ["house", "land", "other", "manufactured"],
        },
        "listings": deduped,
    }
    out_path = DATA_DIR / "listings.json"
    out_path.write_text(json.dumps(output, indent=2))
    print(f"\nWrote {len(deduped)} listings to {out_path}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
