# Google Sheets integration

## Supported link forms

| Form | Example | CSV endpoint used |
| --- | --- | --- |
| Standard edit link | `https://docs.google.com/spreadsheets/d/<ID>/edit#gid=456` | `/spreadsheets/d/<ID>/export?format=csv&gid=456` |
| Link with query gid | `…/edit?gid=456` | same as above |
| Published to web | `https://docs.google.com/spreadsheets/d/e/<PUBID>/pubhtml?gid=…` | `/spreadsheets/d/e/<PUBID>/pub?gid=…&single=true&output=csv` |
| Bare sheet URL (no gid) | `…/spreadsheets/d/<ID>` | first tab (`gid=0`) |

Validation lives in `src/lib/sheets.ts#parseSheetUrl`. Hosts are restricted to
`docs.google.com` and `sheets.google.com` over http(s).

## Access requirements

The sheet must be readable **without sign-in**, because the browser fetches the CSV
directly (no OAuth, no API keys, no server):

- **Share → General access → “Anyone with the link” → Viewer**, or
- **File → Share → Publish to the web** (per tab).

Private sheets return a login redirect or HTTP 401/403. The app detects HTML sign-in
pages masquerading as CSV and shows an actionable error instead of importing junk.

## CORS and caching notes

- Google's `export?format=csv` and `pub?output=csv` endpoints are CORS-enabled for
  anonymous GETs; custom `If-None-Match` headers are **not** sent (they would trigger
  cross-origin preflights). Change detection therefore uses a client-side revision
  hash over the CSV body (`revisionOf`), stored per source as `lastRevision`.
- The service worker **never caches** `docs.google.com` responses — freshness and
  privacy are managed by the sync engine, and the last good dataset is already in
  IndexedDB.

## Multiple tabs / multiple sheets

- The `gid` in the pasted URL selects the tab. To import several tabs, add the same
  spreadsheet once per tab — each becomes an isolated source with its own sync state.
- Sources never overwrite each other: imported ids are namespaced
  (`<sourceId>:<recordKey>`). Combined browsing/planning merges **locally** only.

## Failure modes handled

| Symptom | App behaviour |
| --- | --- |
| 404 | “Spreadsheet not found” — link incomplete or deleted |
| 401/403 or HTML sign-in payload | “Sheet is private” with exact sharing instructions |
| Network/timeout (22 s) | Retry later; previous dataset preserved |
| > 6 MB payload | Refused with size message (protects mobile devices) |
| Empty tab | “Sheet tab appears to be empty” |
| Valid CSV, unusable structure | `invalid` status + missing-column report |

## Future: Google Sheets API

`sheets.ts` is intentionally a narrow seam (`parseSheetUrl` / `fetchCsv`). A Sheets-API
provider for **private** sheets would add OAuth (GIS) and swap `fetchCsv` for an
`export` call behind the same interface — without changing the importer, sync engine,
or storage layers.
