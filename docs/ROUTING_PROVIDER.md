# Routing provider integration

Interface: `src/lib/routing.ts#fetchRoute(points, mode) → ProviderRoute`
(road distance, ETA, decoded geometry, per-leg durations, quality flag) —
provider-independent on purpose.

## Default provider: OSRM demo

- Endpoint `https://router.project-osrm.org/route/v1/{foot|bike|car}/…` with
  `overview=full`, `geometries=polyline`, `annotations=duration` (`steps=false`).
- 15 s timeout, ≤60 coordinates per request, polyline decoded client-side.
- The public demo is a **shared, rate-limited community service** — great for
  development and moderate personal use, not a production SLA.

## Graceful degradation (never destructive)

Offline, timeout, HTTP error, or 429 → fallback to a clearly-labelled approximation:
`Σ(haversine × detour factor)` with per-mode factors (walk 1.32 · cycle 1.30 ·
drive 1.34) and urban Bangladesh speeds (walk 4.9 · cycle 15 · drive 28 km/h).
The UI badge reads *“Approximate · straight-line”* vs *“Road estimate · OSRM”*.
**The optimized order and saved routes are never discarded** on provider failure.

## Production options

1. **Self-host OSRM** (Docker, `osrm-backend`, MLD profile for Bangladesh extract)
   — set `VITE_ROUTING_BASE_URL`.
2. **Managed providers** (GraphHopper, Valhalla, Mapbox Directions) — implement the
   same `ProviderRoute` shape; keep API keys **server-side** behind a tiny proxy
   function (the spec's only optional backend). That proxy must only ever receive
   the coordinate list for the current route — never the spreadsheet dataset —
   and should enforce allow-listed origins, size limits and rate limiting.

## Usage hygiene

- Requests fire only on explicit user action (Optimize), never in background loops.
- Waypoints are capped; the optimizer avoids the O(n²) full road-matrix trap and the
  provider only prices the *final* order.
- “Open in Google Maps” builds a `/maps/dir` URL (≤9 intermediate waypoints) for
  turn-by-turn navigation in the user's preferred app; turn-by-turn is **not**
  claimed offline.
