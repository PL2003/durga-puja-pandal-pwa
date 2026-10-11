# Pandal Hop — Durga Puja Pandal Hopping PWA

An offline-first, mobile-first Progressive Web App for Durga Puja pandal hopping in
Bangladesh. **Your Google Sheet is your data source** — the app downloads it to your
device, resolves coordinates/Maps-links/Plus-Codes, and stores everything locally in
IndexedDB. No accounts, no central mandap database, no tracking of imported data.

## Features

| Area | What it does |
| --- | --- |
| Data sources | Connect one or more public Google Sheets (Share → *Anyone with the link*, or *Publish to web*). Per-source sync status, rename, reference point for short Plus Codes, row-level issue reports, destructive-change confirmation. |
| Location parsing | Decimal pairs, `latitude`/`longitude` columns, Google Maps URLs (`?q=`, `/@lat,lng`, `!3d…!4d`), full Open Location Codes, short Plus Codes (with explicit reference only — never guessed). Conflict detection between columns and the location field. |
| Directory | Search, per-source or combined browsing, detail sheets, social links, unresolved-record triage, nearest-first sorting. |
| Map | Leaflet + CARTO dark tiles (cached for offline), gold numbered pins, route polyline, live GPS dot, nearby list. |
| Route planning | You pick exactly which mandaps to visit. Web-Worker **nearest-neighbour + 2-Opt** optimizer (bounded iterations), start from GPS or first stop, walking/cycling/driving modes. |
| Routing provider | Pluggable provider interface; default OSRM demo endpoint for road distances/ETAs/geometry, with clearly-labelled straight-line fallback that never destroys saved routes. |
| Offline | Service worker caches the app shell + map tiles; IndexedDB keeps data, routes, prefs. Automatic sync on app start, foregrounding, and reconnect — never promised while the app is closed. |
| PWA | Installable (`manifest.webmanifest` + service worker), Android-friendly, landscape/portrait, safe-area aware. |

## Architecture at a glance

```
Google Sheets (user-owned) ──CSV──> importer (papaparse)
                                   │  location.ts: coords / Maps URLs / Plus Codes
                                   ▼
                        IndexedDB (sources · mandaps · routes · prefs)
                                   │
     ┌───────────────┬─────────────┼───────────────┬────────────┐
  Directory       Map (Leaflet)  Planner        Routes      Sync engine
                                     │
                optimizer.worker (2-Opt)  →  routing provider (OSRM / fallback)
```

- **No backend required.** Optional future serverless proxy for privileged routing
  keys is described in `docs/ROUTING_PROVIDER.md`; user datasets must never be sent there.

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/ (single-file shell + /sw.js, /manifest.webmanifest, /icons)
npm run preview    # serve the production build
```

## Test

```bash
npx vitest run     # location parsing, sheet URLs, importer, optimizer
```

Manual QA checklist (install, offline startup, sync failure recovery, short-Plus-Code
handling, routing-failure degradation): see `docs/TESTING.md`.

## Docs

- `docs/ARCHITECTURE.md` — modules, data flow, design decisions
- `docs/GOOGLE_SHEETS.md` — supported links, sharing settings, CSV endpoints
- `docs/DATA_FORMAT.md` — columns, aliases, example sheet
- `docs/LOCATION_PARSING.md` — GPS / Maps URL / Plus Code resolution rules
- `docs/LOCAL_STORAGE.md` — IndexedDB schema & migrations
- `docs/SYNCHRONIZATION.md` — triggers, revision detection, failure handling
- `docs/ROUTE_OPTIMIZATION.md` — algorithm, assumptions, limitations
- `docs/ROUTING_PROVIDER.md` — provider interface & production options
- `docs/OFFLINE.md` — caching strategies & offline matrix
- `docs/SECURITY.md` — privacy & security model
- `docs/TESTING.md` — automated + manual test procedures
- `docs/DEPLOYMENT.md` — build & hosting notes

## Sheet quickstart

1. In Google Sheets: **Share → Anyone with the link (Viewer)**, or **File → Share → Publish to the web**.
2. Copy the address-bar URL of the tab you want (`…#gid=` selects the tab).
3. In Pandal Hop → **Sources** → paste → **Connect & import**.
4. Browse in **Explore**, tap **Add to plan**, open **Plan**, **Optimize**.

Minimum columns: `name` and `location` (or `latitude` + `longitude`). Full reference
with an example sheet: `docs/DATA_FORMAT.md`.

## Privacy

Imported mandap records, saved routes, sheet URLs and sync metadata live only in your
browser's IndexedDB. The app sends coordinates to external providers **only** when you
request road routing (OSRM) or open Google Maps navigation — and only the selected
stops, never the whole dataset. See `docs/SECURITY.md`.
