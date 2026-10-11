# Location parsing & validation

Implemented in `src/lib/location.ts` (`resolveLocation`), using the maintained
[`open-location-code`](https://www.npmjs.com/package/open-location-code) library.

## Resolution strategy (strict priority)

1. **Valid `latitude` + `longitude` columns** — finite numbers, lat ∈ [−90,90],
   lng ∈ [−180,180]. Invalid/missing single-axis pairs produce `invalid-coords`.
2. **Decimal pair inside `location`** — `22.3569, 91.7832` (comma/semicolon/space
   separated). Clearly reversed `lng, lat` input (first value > 90) is swapped.
3. **Google Maps URL coordinates** — hosts matching `*.google.tld/maps` (any ccTLD):
   - `!3dLAT!4dLNG` embedded place coordinates (most precise, wins),
   - `?q= / query= / center= / ll=lat,lng`,
   - `/@lat,lng,zoom` viewport coordinates (approximate).
   Place links *without* embedded coordinates cannot be resolved client-side; the row is
   flagged with an explanation (drop a pin → Share → copy link). Shortened
   `goo.gl`/`maps.app.goo.gl` links are rejected explicitly — they need a server round
   trip and there's no server; open once and paste the long URL.
4. **Full Plus Code** — `OpenLocationCode.isValid` + `isFull`, decoded to the code-area
   center and range-checked.
5. **Short Plus Code + explicit reference** — recovered with
   `OpenLocationCode.recoverNearest(code, refLat, refLng)`. The reference comes from
   the row's own valid lat/lng columns, or the **per-source reference point** set in
   Sources → Reference. Without one: `shortcode-no-reference` issue, record kept
   unmapped. **A short code is never treated as globally unique and locality is never
   guessed** (including from the `address` text — no implicit geocoding).
6. **External geocoding** — not configured in this build; the seam is
   `resolveLocation`'s final step and would require an explicit opt-in provider.

## Conflict handling

If valid lat/lng columns **and** a parseable `location` disagree by more than 60 m,
the columns win (documented tie-break) and a `conflict` *warning* issue is attached —
never a silent pick.

## Validation rules

- Coordinates must be finite numbers within Earth ranges and usable for
  mapping/routing; anything else is reported with the sheet row number.
- URL schemes are restricted to http/https; hosts for map links must be Google.
- Plus Code characters/structure validated by the OLC library before decoding.
- The original `location` string is always preserved on the record as `locationRaw`.

## Record identity

`id` column → `id-<value>` (duplicates get a `-<row>` suffix *and* a warning);
otherwise deterministic `row-<sheetRow>`. Local id = `<sourceId>:<recordKey>`, so the
same row survives refreshes, and identical mandap names across sources never collide.
Row moves without an `id` column are treated as removal + addition — use `id`/`sl`
columns for long-lived sheets.
