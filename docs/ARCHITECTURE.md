# Architecture

## Principles

1. **Local-first.** Google Sheets owned by the user are the only upstream data source.
   Imported records live exclusively in the device's IndexedDB. There is deliberately
   **no central mandap database** — the app cannot merge, mine, or re-share datasets.
2. **No mandatory backend.** A static host serves the PWA shell. Optional serverless
   pieces (routing proxy for protected keys) may be added later without ever receiving
   the imported dataset.
3. **Network is an enhancement.** Every core flow (directory, map-cached data,
   selection, optimization, saved routes) works fully offline after the first sync.

## Module map (src/)

```
src/
├── App.tsx                 shell: header, tab router, offline banner, tab bar
├── main.tsx                entry; registers /sw.js in production
├── index.css               Tailwind v4 theme + Leaflet dark theme + pin CSS
├── types.ts                SourceMeta · Mandap · ParsedSheet · SavedRoute · RouteResult
├── state/
│   └── AppState.tsx        global store: sources, mandaps, selection, routes,
│                           auto-sync triggers (start/foreground/online), toasts
├── lib/
│   ├── sheets.ts           Google Sheet URL validation + CSV fetch + revision hash
│   ├── importer.ts         CSV → column map → Mandap[] + per-row ImportIssue[]
│   ├── location.ts         decimal pairs / Google Maps URLs / OLC plus codes
│   ├── db.ts               IndexedDB schema + transactional operations
│   ├── sync.ts             sync engine: fetch→validate→(confirm)→transactional commit
│   ├── optimizerCore.ts    pure TSP heuristic (tested, UI-independent)
│   ├── optimize.ts         Blob-Worker wrapper with main-thread fallback
│   ├── routing.ts          provider-independent routing (OSRM + labelled fallback)
│   ├── geo.ts              haversine, formatting, polyline decode
│   └── demo.ts             bundled local sample dataset (deletable source)
├── workers/
│   └── optimizer.worker.js self-contained worker (loaded via Blob URL so it works
│                           inside single-file builds)
├── screens/
│   ├── SourcesScreen.tsx   connect/validate/rename/remove sheets, issue reports
│   ├── ExploreScreen.tsx   directory, search, filters, detail view, unresolved rows
│   ├── MapScreen.tsx       Leaflet map, nearby sheet, selection strip
│   ├── PlanScreen.tsx      start/mode/stops → optimize → save/navigate
│   └── RoutesScreen.tsx    saved routes (offline), rename/delete/re-plan
└── components/
    ├── MapView.tsx         reusable Leaflet wrapper
    └── ui.tsx              toasts, sheets/modals, segmented controls, empty states
```

## Data flow

1. **Import/sync**: `sheets.ts` validates the pasted URL and derives the CSV endpoint
   (`export?format=csv&gid=` for standard sheets, `/pub?output=csv` for published).
   `fetchCsv` guards size (6 MB) and detects HTML sign-in responses. `importer.ts`
   maps headers case-insensitively (with aliases), then `location.ts` resolves each
   record. Records always keep `locationRaw` for troubleshooting.
2. **Commit**: `sync.ts` compares a revision hash, detects structural failures and
   empty-sheet wipes, and `db.ts#replaceSourceMandaps` transactionally replaces only
   records owned by that source while updating `sources` in the same transaction.
   Failed steps leave the previous good dataset untouched.
3. **Planning**: selection (persisted in `prefs`) → worker optimization over
   haversine matrix → `routing.ts` turns the chosen order into road estimates when a
   provider is reachable, otherwise a clearly-labelled approximation (`×` detour
   factor + mode speed).
4. **Persistence**: `saved_routes` store keeps order, metrics, and provider-permitted
   geometry; everything reopens without network.

## Concurrency & performance notes

- Optimization runs off the main thread (Blob worker) with a time budget
  (2.8 s default, 250-iteration cap) and automatic main-thread fallback.
- IndexedDB writes are transactional; quota errors surface as friendly messages.
- About 40 selected stops is the enforced planner cap (documented limitation).
- Map markers are simple divIcons; datasets in pandal-hopping practice are
  (tens to low hundreds). Clustering/`L.canvas` can be enabled in `MapView` for
  very large sheets without touching state code.
