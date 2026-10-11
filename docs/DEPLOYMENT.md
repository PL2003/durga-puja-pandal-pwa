# Deployment

## Build

```bash
npm install
npm run build     # → dist/
```

Output: single-file `dist/index.html` (JS/CSS inlined by design) plus
`dist/sw.js`, `dist/manifest.webmanifest`, `/icons/*`, `/img/*`.

## Hosting requirements

1. **HTTPS is mandatory** — service workers and installability require a secure
   context (`localhost` excepted for development).
2. Serve `dist/` statically (any CDN/static host: Netlify, Vercel, Cloudflare
   Pages, Firebase Hosting, GitHub Pages…).
3. Ensure `sw.js` is served with `Cache-Control: no-cache` and correct MIME types:
   `.webmanifest` → `application/manifest+json`.

Recommended headers — **ready-made configs already ship in the repo**:
`netlify.toml` (Netlify), `vercel.json` (Vercel) and `public/_headers`
(Netlify + Cloudflare Pages). Because this project intentionally builds a
**single-file bundle** (JS/CSS inlined into `index.html`), the CSP must include
`script-src 'unsafe-inline'`; the optimizer also runs from a Blob worker:

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'unsafe-inline' blob:;
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: blob: https://*.basemaps.cartocdn.com
    https://*.tile.openstreetmap.org https://*.googleusercontent.com https://*.ggpht.com;
  connect-src 'self' https://docs.google.com https://sheets.googleapis.com
    https://*.basemaps.cartocdn.com https://router.project-osrm.org;
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: geolocation=(self)
```

Also serve `sw.js` with `Cache-Control: no-cache` and `Service-Worker-Allowed: /`
(all included in the shipped configs).

## Verify after deploy

1. Open the site on Android Chrome → menu shows **Install app** (or in-app Install
   button after `beforeinstallprompt`).
2. DevTools → Application → *Service Workers*: `sw.js` activated; *Manifest*: icons
   valid; *Storage*: IndexedDB `pandal-hop` created after first sync.
3. Airplane-mode cold start → shell loads, offline banner visible, last data usable.
4. Install-badge criteria: manifest id/start_url/scope, 192+512 icons, offline
   fetch handler ✓.

## Updating users

Bump `VERSION` inside `public/sw.js` with each release so old caches are pruned on
activation; the shell is network-first, so users pick up new versions on next load.

## Optional backend (only if needed later)

A single serverless function for a **routing proxy with server-held provider keys** is
the sole sanctioned backend. It must accept only `{points[], mode}`, call the provider
server-side, and return the normalized `ProviderRoute`. It must never accept sheet URLs
or dataset payloads (see `docs/ROUTING_PROVIDER.md` and `docs/SECURITY.md`).
