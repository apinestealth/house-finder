# House Finder

Personal tool for finding cheap Northeast US land + cabins near ski areas and within drive of Ridgewood, NY.

- **Daily scrape** of Redfin for listings ≤ $100k on ≥ 2 acres across NY, VT, NH, ME, MA, RI
- For each listing, computes driving time to Ridgewood NY and nearest of ~50 NE ski resorts using the free OSRM public demo server
- **UI** (map + filterable list) deployed for free on GitHub Pages

```
.
├── .github/workflows/   # daily scrape + Pages deploy (free)
├── scraper/             # Python scraper
├── data/                # listings.json (committed nightly), resorts.json
└── web/                 # React + Vite + Leaflet UI
```

## Setup

### 1. Push to GitHub

```bash
cd house-finder
git init
git add .
git commit -m "initial commit"
gh repo create house-finder --public --source=. --push
```

(Or create the repo on github.com manually and `git remote add origin ...` + `git push`.)

### 2. Enable GitHub Pages

In the new repo on GitHub:

1. **Settings → Pages** → "Build and deployment" → Source: **GitHub Actions**
2. **Settings → Actions → General** → "Workflow permissions" → **Read and write permissions** (so the scrape workflow can commit `data/listings.json` back to main)

### 3. Set base path (only if repo name isn't your `username.github.io` repo)

GitHub Pages serves project sites under `https://<user>.github.io/<repo>/`. Vite needs to know that subpath.

In the repo: **Settings → Secrets and variables → Actions → Variables → New variable**
- Name: `VITE_BASE`
- Value: `/house-finder/` (or whatever your repo is named, with leading & trailing slashes)

### 4. Trigger first run

- **Actions → Daily scrape → Run workflow** to do the first scrape immediately (otherwise it runs at 07:30 UTC daily)
- Once that commits `data/listings.json`, the **Deploy site** workflow fires automatically and publishes the page

After both workflows finish, your site lives at:
- `https://<user>.github.io/house-finder/` (project site), or
- `https://<user>.github.io/` (if the repo is named `<user>.github.io`)

## Running locally

```bash
# Scrape (writes data/listings.json + data/distance_cache.json)
pip install -r scraper/requirements.txt
python scraper/scrape.py

# Run the UI
cd web
npm install
npm run sync-data   # copies data/ into public/ for dev server
npm run dev
```

Open the dev URL Vite prints (usually `http://localhost:5173`).

## Tweaking what gets scraped

`scraper/scrape.py`:
- `PRICE_CAP = 100_000` — daily-scrape price ceiling
- `MIN_ACRES = 2` — daily-scrape acreage floor
- `STATE_NAMES` — which states to crawl
- `uipt=1,5,6,7` in `fetch_listings_csv` — property types (1=house, 5=land, 6=other, 7=manufactured)

These set the **broad daily-scrape range**. The UI can filter narrower than these but can't widen past them — change here and re-run.

## Things to know

- **Redfin only.** Realtor.com / Zillow not scraped yet. The scraper is modular — adding another source means writing a sibling `fetch_*` function and merging into `all_listings` in `main()`.
- **Single-page-per-state.** Redfin's CSV endpoint returns up to 350 listings per query. If your filters get loose enough that a state has >350 matches, results will be truncated. Tighten the filters or subdivide by county.
- **OSRM public demo is best-effort.** It's free but has no SLA. If it's flaking, the scraper skips that listing. On a clean run with a warm `distance_cache.json` it should be fast.
- **Repo must be public** for free GitHub Pages.

## Files of interest

- `scraper/scrape.py` — Redfin fetch + parse
- `scraper/distances.py` — OSRM routing with grid-cell cache
- `data/resorts.json` — ~50 NE ski resorts; edit to add/remove
- `web/src/App.tsx` — filter + sort logic
- `web/src/Filters.tsx` — filter UI
- `.github/workflows/scrape.yml` — daily cron
- `.github/workflows/deploy.yml` — Pages deploy
