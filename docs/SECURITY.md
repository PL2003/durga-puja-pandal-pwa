# Security & privacy model

## Data ownership

- Imported mandap records, saved routes, sheet URLs and sync metadata live only in
  the device's IndexedDB. The project ships **no central database** and no code path
  that uploads imported records anywhere.
- Only the coordinates of *the selected route stops* ever reach the routing provider
  (OSRM) on explicit user action; navigating to Google Maps shares whatever that app
  normally receives. Both are disclosed at the point of use (quality badge, outbound
  link).
- No accounts, no passwords, no device fingerprinting, no analytics, no ad SDKs.

## Input handling

- Google Sheets links are host-allow-listed (`docs.google.com` / `sheets.google.com`),
  scheme-restricted to http(s), and parsed with `URL` — never string-concatenated into
  HTML.
- CSV parsing is PapaParse's safe text parser; spreadsheet values are rendered as
  React text nodes (auto-escaped). No `dangerouslySetInnerHTML` anywhere. External
  URLs from the sheet (images/socials) render as inert `href`/`src` only, with images
  hidden on error and links opening `rel="noreferrer"`.
- Fetch guards: 22 s timeout, 6 MB cap, HTML-payload detection, HTTP status mapping.
- No server-side fetching exists → no SSRF surface. If a future routing proxy is
  added, it must fetch no user URLs, allow-list the provider origin, and cap payload
  size.

## Keys & secrets

There are none. `.env.example` documents optional provider URLs only. Privileged
routing keys, if ever needed, belong behind the optional serverless proxy — never in
the frontend bundle.

## PWA hardening

- Installable only over HTTPS; service worker caches are versioned and pruned.
- Google endpoints are explicitly excluded from SW caching (freshness + privacy).
- Recommended hosting headers (see `docs/DEPLOYMENT.md`): CSP restricting
  `connect-src` to self + Google + tile/routing hosts, `X-Content-Type-Options`,
  `Referrer-Policy: strict-origin-when-cross-origin`.

## Data minimisation & retention

- Geolocation is requested only on tap; the fix stays in-memory (and is used solely
  for sorting/starting routes).
- Removing a source deletes its cached records on-device; deleting the app (or site
  data) erases everything permanently.
