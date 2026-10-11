# Testing

## Automated (Vitest)

```bash
npx vitest run
```

| File | Covers |
| --- | --- |
| `src/lib/__tests__/location.test.ts` | Decimal pairs (incl. swapped input), out-of-range rejection, Google Maps `?q` / `@` / `!3d!4d` extraction, coordinate-less place links, full Plus Code decode, short Plus Code without/with reference, malformed codes, non-Google URLs, column priority, conflict flag. |
| `src/lib/__tests__/sheets.test.ts` | Standard/published link parsing, gid extraction (hash & query), invalid hosts, garbage input, revision-hash stability. |
| `src/lib/__tests__/importer.test.ts` | Case-insensitive aliasing, lat/lng column support, missing-column detection, row numbers on issues, duplicate id determinism, stable identity strategy. |
| `src/lib/__tests__/optimizer.test.ts` | Exact stop-set preservation, anchor/end pinning, non-worsening vs naive order, degenerate inputs, bounded runtime. |

## Manual QA checklist

**Sheets & sync**
- [ ] Add a public sheet → valid rows import; issue modal lists bad rows w/ row numbers.
- [ ] Fix a row in Google Sheets → Refresh now → counts update (added/updated/removed).
- [ ] Delete a row in the sheet → refresh → record disappears locally.
- [ ] Make the sheet private → refresh → error shown, old data intact.
- [ ] Empty the sheet → refresh → *confirm-empty* sheet appears; cancel keeps data.
- [ ] Two sources with identical mandap names → both coexist; source filter separates.

**Location**
- [ ] Full Plus Code resolves; short Plus Code imports only with a source reference.
- [ ] Conflicting lat/lng vs location column → conflict warning, columns win.
- [ ] `goo.gl` short link → actionable rejection.

**Planner & routes**
- [ ] Reorder up/down persists; >40 stops blocked; unresolved rows are skipped w/ notice.
- [ ] Airplane mode → optimize → *approx* badge; back online → re-optimize → *road* badge.
- [ ] Routing provider failure (block router.project-osrm.org) → order retained, approx shown, save works.
- [ ] Saved route: reopen offline, rename, delete, re-plan, Maps handoff URL.

**PWA**
- [ ] `npm run preview` on HTTPS-capable host → Install prompt; launches standalone.
- [ ] Kill network → cold start works; cached tiles render; banner shows Offline.
- [ ] Foreground/background cycle → one throttled auto-sync (dev tools network tab).

**Storage**
- [ ] DevTools → Application → IndexedDB `pandal-hop` → 4 stores & indexes present.
- [ ] Fill storage or set tiny quota → friendly “storage full” error, no corruption.
