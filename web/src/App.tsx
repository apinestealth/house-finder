import { useEffect, useMemo, useState } from "react";
import { Filters } from "./Filters";
import { ListingCard } from "./ListingCard";
import { MapView } from "./MapView";
import { FilterState, Listing, ListingsData, Resort, SortKey } from "./types";

const DEFAULT_FILTERS: FilterState = {
  priceMin: 0,
  priceMax: 100_000,
  acresMin: 2,
  acresMax: 500,
  yearBuiltMin: 1700,
  yearBuiltMax: 2100,
  skiHoursMax: 1,
  ridgewoodHoursMax: 6,
  propertyType: "all",
  states: new Set(["NY", "VT", "NH", "ME", "MA", "RI"]),
  sortBy: "ridgewoodHoursAsc",
};

const SORT_LABELS: Record<SortKey, string> = {
  ridgewoodHoursAsc: "Drive to Ridgewood ↑",
  skiHoursAsc: "Drive to ski ↑",
  priceAsc: "Price ↑",
  priceDesc: "Price ↓",
  acresDesc: "Acres ↓",
  yearBuiltDesc: "Year built ↓",
};

function basePath(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : base + "/";
}

export default function App() {
  const [data, setData] = useState<ListingsData | null>(null);
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = basePath();
    Promise.all([
      fetch(`${root}data/listings.json`).then((r) => r.json()),
      fetch(`${root}data/resorts.json`).then((r) => r.json()),
    ])
      .then(([listings, resortsData]) => {
        setData(listings);
        setResorts(resortsData);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.listings.filter((l) => filterListing(l, filters));
  }, [data, filters]);

  const sorted = useMemo(() => sortListings(filtered, filters.sortBy), [filtered, filters.sortBy]);

  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString()
    : "never";

  return (
    <div className="app">
      <div className="header">
        <h1>House Finder · NE land &amp; cabins</h1>
        <div className="meta">
          last scrape: {generatedAt}
          {data ? ` · ${data.count} total` : ""}
        </div>
      </div>
      <div className="body">
        <Filters value={filters} onChange={setFilters} />
        <div className="list-pane">
          <div className="list-toolbar">
            <div className="count">{sorted.length} matches</div>
            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters({ ...filters, sortBy: e.target.value as SortKey })
              }
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="list-scroll">
            {error && <div className="empty">Failed to load data: {error}</div>}
            {!error && !data && <div className="empty">Loading…</div>}
            {!error && data && sorted.length === 0 && (
              <div className="empty">No listings match these filters.</div>
            )}
            {sorted.map((l) => (
              <ListingCard key={`${l.url}-${l.lat}-${l.lng}`} listing={l} />
            ))}
          </div>
        </div>
        <div className="map-pane">
          <MapView listings={sorted} resorts={resorts} />
        </div>
      </div>
    </div>
  );
}

function filterListing(l: Listing, f: FilterState): boolean {
  if (l.price < f.priceMin || l.price > f.priceMax) return false;
  if (l.lotAcres != null) {
    if (l.lotAcres < f.acresMin || l.lotAcres > f.acresMax) return false;
  }
  if (!l.isLand && l.yearBuilt && l.yearBuilt > 0) {
    if (l.yearBuilt < f.yearBuiltMin || l.yearBuilt > f.yearBuiltMax) return false;
  }
  if (l.skiHours > f.skiHoursMax) return false;
  if (l.ridgewoodHours > f.ridgewoodHoursMax) return false;
  if (f.propertyType === "house" && l.isLand) return false;
  if (f.propertyType === "land" && !l.isLand) return false;
  if (l.state && f.states.size > 0 && !f.states.has(l.state)) return false;
  return true;
}

function sortListings(items: Listing[], key: SortKey): Listing[] {
  const copy = [...items];
  switch (key) {
    case "ridgewoodHoursAsc":
      copy.sort((a, b) => a.ridgewoodHours - b.ridgewoodHours);
      break;
    case "skiHoursAsc":
      copy.sort((a, b) => a.skiHours - b.skiHours);
      break;
    case "priceAsc":
      copy.sort((a, b) => a.price - b.price);
      break;
    case "priceDesc":
      copy.sort((a, b) => b.price - a.price);
      break;
    case "acresDesc":
      copy.sort((a, b) => (b.lotAcres ?? 0) - (a.lotAcres ?? 0));
      break;
    case "yearBuiltDesc":
      copy.sort((a, b) => (b.yearBuilt ?? 0) - (a.yearBuilt ?? 0));
      break;
  }
  return copy;
}
