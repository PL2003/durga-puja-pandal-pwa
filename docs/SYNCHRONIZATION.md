# Synchronization

Engine: `src/lib/sync.ts`, orchestrated by `src/state/AppState.tsx`.

## Triggers

1. **App start** — if online and sheet sources exist.
2. **Foreground** (`visibilitychange` → visible) — throttled to once / 90 s.
3. **Reconnect** (`online` event).
4. **Manual** — header sync-all button; per-source **Refresh now** (force).
5. Configurable foreground interval can be layered on `maybeAutoSync` later.

> Mobile browsers suspend closed PWAs; background sync is therefore only described
> as a possible future enhancement — **never promised**.

## Pipeline (per source)

1. Mark attempt (`lastAttemptAt`, status `syncing`).
2. `fetchCsv` with 22 s timeout, 6 MB cap, HTML-sign-in detection.
   Failure → status `sync-failed`, **dataset untouched**.
3. Revision hash (`revisionOf`) equals `lastRevision` → status `ok`, no record writes.
4. `parseSheet` → column map + records + issues.
5. Structural failures (missing required columns / empty) → status `invalid`,
   dataset untouched, issues surfaced.
6. **Destructive guard**: parse yields 0 valid records while the device holds data →
   status `confirm-empty`; only explicit user confirmation (or retry with
   `allowEmpty`) proceeds.
7. `replaceSourceMandaps` transaction: diff by `recordKey`
   (added / updated / removed), write source metadata with new
   `lastSyncAt`/`lastRevision`/`datasetVersion`.
8. UI refreshes lists/map; summary toast reports the diff.

## Deletion policy

- A row that disappears from a **successful** sync is removed from that source's
  records (by design).
- Saved routes and other sources are never touched. Saved routes referencing removed
  mandaps render them struck-through instead of deleting anything.
- A structurally invalid or unexpectedly empty sheet never erases data without
  confirmation.

## Statuses

`idle` · `syncing` · `ok` (up to date) · `sync-failed` · `invalid` · `confirm-empty`.
The Source card shows last successful sync time, issue counts (tap for per-row
diagnostics), and dataset version. Offline state is a separate banner/pill — cached
data remains fully usable.
