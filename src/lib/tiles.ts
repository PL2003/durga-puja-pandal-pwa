/**
 * Map tile providers — every built-in provider is 100% KEYLESS.
 * The app never needs an API key. If a provider is unreachable on the user's
 * network, MapView automatically falls back through this list.
 */

export interface TileProvider {
  name: string;
  url: string;
  attribution: string;
  subdomains: string;
  maxZoom: number;
}

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

const PROVIDERS: TileProvider[] = [
  {
    name: "CARTO Dark (keyless)",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      `${OSM_ATTR} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>`,
    subdomains: "abcd",
    maxZoom: 20,
  },
  {
    name: "OpenStreetMap (keyless)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTR,
    subdomains: "abc",
    maxZoom: 19,
  },
  {
    name: "OSM Hot (keyless)",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: `${OSM_ATTR}, hosted by <a href="https://openstreetmap.fr/" target="_blank" rel="noreferrer">OSM France</a>`,
    subdomains: "abc",
    maxZoom: 19,
  },
];

/**
 * Ordered list of tile providers to try. Set VITE_TILE_URL to prepend your own
 * (e.g. a self-hosted tile server) — it must be a {z}/{x}/{y} template.
 */
export function getTileProviders(): TileProvider[] {
  const custom = (import.meta.env.VITE_TILE_URL as string | undefined) || "";
  if (!custom.trim()) return PROVIDERS;
  return [
    ...PROVIDERS.slice(0, 0),
    {
      name: "Custom tile server",
      url: custom.trim(),
      attribution: OSM_ATTR,
      subdomains: "abc",
      maxZoom: 20,
    },
    ...PROVIDERS,
  ];
}
