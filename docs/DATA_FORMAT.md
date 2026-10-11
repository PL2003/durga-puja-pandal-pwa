# Spreadsheet data format

## Required

- `name` — mandap/pandal name.
- `location` — coordinates, a Google Maps link, or a Plus Code.

`location` may be replaced by a **pair** of columns: `latitude` + `longitude`.

There is **no city/zone/district column** (zones are out of scope). Free-text locality
belongs in `address` and helps humans (and you) resolve short Plus Codes.

## Full column reference

| Column | Requirement | Description |
| --- | --- | --- |
| `name` | Required | Mandap name. Rows without a name are reported, not imported. |
| `location` | Required if no lat/lng | `22.3569, 91.7832` · `https://www.google.com/maps?q=…` · `7JCR9RW8+V2J` · `9RW8+V2J` |
| `latitude`, `longitude` | Optional | Decimal degrees; validated as a pair; win over `location` when valid. |
| `address` | Optional | Human-readable locality. |
| `description` | Optional | Any extra info (rendered as plain text). |
| `image_url` | Optional | Public image URL (lazy-loaded; hidden on error). |
| `facebook_url` | Optional | Official page link. |
| `instagram_url` | Optional | Official page link. |
| `opening_hours` | Optional | Visiting info, free text. |
| `id` | Optional | Stable per-row identity across refreshes (`sl` / `serial` also work). |

## Header matching

- Case-insensitive, whitespace-tolerant: ` Name `, `NAME`, `name` are identical.
- Common aliases (see `HEADER_ALIASES` in `src/lib/importer.ts`):
  `mandap`, `pandal`, `venue` → name · `google maps`, `map link`, `pluscode`,
  `coordinates` → location · `lat` / `lng|lon|long` · `photo`, `img` → image_url ·
  `timings`, `visiting hours` → opening_hours · `sl no`, `serial` → id …
- Prefix headers like `mandap name (english)` fall back to alias starts-with matching.

## Example sheet

| name | location | address | opening_hours | id |
| --- | --- | --- | --- | --- |
| Dhakeshwari National Temple | 23.7229, 90.3962 | Dhakeshwari Rd, Dhaka | 6:00–23:00 | 01 |
| Ramna Kali Mandir | https://www.google.com/maps?q=23.7379,90.3989 | Ramna Park | 6:00–22:00 | 02 |
| JM Sen Hall Puja | 9QGX+7W2 *(short code!)* | Rahmatganj, Chattogram | 8:00–23:00 | 03 |

> Row 03 needs either the source's **reference point** or its own `latitude`/`longitude`
> values — short Plus Codes are never guessed.

## Row diagnostics

Every problem row is reported with its **spreadsheet row number** (header = row 1):
missing name · missing/invalid location · invalid coordinates pair · non-Google URL ·
Google link without extractable coordinates · malformed Plus Code · short Plus Code
without reference · conflicting lat/lng vs location field · duplicate ids · near-duplicate
name+position pairs. Invalid rows are imported as named records *without* coordinates and
listed under “Needs location fixes” — nothing is silently dropped.
