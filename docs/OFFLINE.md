# Offline behavior

Service worker: `public/sw.js` (registered in production by `src/main.tsx`).

## Cache strategies

| Resource | Strategy | Cache |
| --- | --- | --- |
| App shell (`/`, bundled JS/CSS, icons, manifest) | Network-first → cache fallback; navigations fall back to cached `/` | `ph-shell-v1` |
| Map tiles (openstreetmap.org, basemaps.cartocdn.com) | Stale-while-revalidate, capped at 450 entries | `ph-tiles-v1` |
| `docs.google.com` / Sheets API | **Network-only** — freshness & privacy belong to the sync engine | none |

Old caches are dropped on activation; `skipWaiting` + `clients.claim` make updates
predictable.

## Offline capability matrix

| Works offline | Needs network |
| --- | --- |
| Opening the app shell | Fetching/updating spreadsheets |
| Browsing/searching the synced directory | New place/shortened-link resolution |
| Map (visited tiles) + markers + route geometry | Uncached map regions |
| Selecting stops, 2-Opt optimization | Road routing — falls back to straight-line |
| Saved routes (full detail, re-plan) | Live “navigate” handoff (opens Maps app) |
| Sources screen metadata & issue history | — |

## Signals in the UI

- Persistent gold **offline banner** + `Offline` pill on source cards.
- Toasts on `offline`/`online`; reconnect automatically triggers a sync.
- Route results carry a quality badge (`road` vs `approx`) so cached/approximate
  information is always visually distinct from live results.
- Turn-by-turn directions are only offered via an external Maps app — never implied
  to work offline.
