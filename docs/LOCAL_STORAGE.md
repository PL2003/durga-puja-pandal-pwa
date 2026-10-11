# Local storage (IndexedDB)

Database `pandal-hop`, version 1, opened in `src/lib/db.ts`. localStorage is **not**
used for dataset storage (only nothing at all — every byte lives in IndexedDB).

## Stores

### `sources` — keyPath `id`
`SourceMeta`: original URL, derived CSV endpoint, sheet/gid ids, kind
(`google-sheet` | `demo`), reference point for short Plus Codes, status
(`idle|syncing|ok|sync-failed|invalid|confirm-empty`), `lastAttemptAt`,
`lastSyncAt`, `lastRevision` (content hash), `lastError`, `datasetVersion`,
`validCount`, `issueCount`, `createdAt`.

### `mandaps` — keyPath `id` (`<sourceId>:<recordKey>`)
Full normalized record incl. `locationRaw`, resolved `lat/lng`, `locationKind`,
social links, hours, `row`, `updatedAt`.
Indexes: `by-source` (sourceId), `by-record` ([sourceId, recordKey], unique),
`by-name` (nameKey lowercase), `by-lat` (quick geo pre-filter).

### `routes` — keyPath `id`
`SavedRoute`: name, selected ids, visiting order, start point+label, travel mode,
distance/duration, quality (`road|approx`), provider-permitted geometry,
created/updated timestamps.

### `prefs` — keyPath `key`
Selection, source filter, travel mode, per-source issue snapshots
(`issues:<sourceId>`) for later review.

## Transactions & failure handling

- Source refresh = **one transaction over `(mandaps, sources)`**: delete records
  vanished from the sheet, upsert additions/updates, and write source metadata —
  interrupted mid-way → whole transaction aborts, previous dataset intact.
- `QuotaExceededError` (incl. Firefox `NS_ERROR_DOM_QUOTA_REACHED`) maps to a friendly
  “device storage full” message; the user can remove sources to free space.
- Store eviction (user clears site data) is handled gracefully: the app simply boots
  to the empty onboarding state; saved-route JSON export is a documented TODO for
  users who need off-device backups (import route via Google Maps link still works).

## Migrations

`onupgradeneeded` creates all v1 stores/indexes. Future versions must append
numbered creation blocks (never mutate existing stores destructively) and bump
`DB_VERSION`.
