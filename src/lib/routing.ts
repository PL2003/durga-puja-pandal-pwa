/**
 * Provider-independent routing. Default provider: public OSRM demo instance.
 * The optimizer decides the visiting order; the provider only supplies road
 * distances, ETAs and geometry. On any failure we degrade to a clearly-labelled
 * haversine approximation — the saved route and order are never destroyed.
 */
import { decodePolyline, haversineMeters, MODE_SPEED, ROAD_FACTOR } from "@/lib/geo";
import type { LatLng, TravelMode } from "@/types";

export interface ProviderRoute {
  distanceM: number;
  durationS: number;
  geometry: [number, number][] | null;
  quality: "road" | "approx";
  /** per-leg durations in seconds (points.length - 1 entries) */
  legDurations: number[];
}

const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const PROFILE: Record<TravelMode, string> = { walking: "foot", cycling: "bike", driving: "car" };
const MAX_COORDS = 60;
const TIMEOUT_MS = 15000;

function approximate(points: LatLng[], mode: TravelMode): ProviderRoute {
  let distanceM = 0;
  const legDurations: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = haversineMeters(points[i - 1], points[i]) * (ROAD_FACTOR[mode] || 1.32);
    distanceM += d;
    legDurations.push(d / (MODE_SPEED[mode] || 1.35));
  }
  return {
    distanceM,
    durationS: legDurations.reduce((s, v) => s + v, 0),
    geometry: points.length >= 2 ? points.map((p) => [p.lat, p.lng] as [number, number]) : null,
    quality: "approx",
    legDurations,
  };
}

export async function fetchRoute(points: LatLng[], mode: TravelMode): Promise<ProviderRoute> {
  if (points.length < 2) {
    return { distanceM: 0, durationS: 0, geometry: null, quality: "road", legDurations: [] };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return approximate(points, mode);
  }
  const capped = points.slice(0, MAX_COORDS);
  try {
    const coords = capped.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const url = `${OSRM_BASE}/${PROFILE[mode]}/${coords}?overview=full&geometries=polyline&annotations=duration&steps=false`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      if (res.status === 429) throw new Error("Routing provider rate-limited (429).");
      throw new Error(`Routing provider error (HTTP ${res.status}).`);
    }
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route) throw new Error("Routing provider returned no route.");
    const legDurations: number[] = Array.isArray(route.legs)
      ? route.legs.map((l: { duration?: number }) => Number(l?.duration ?? 0))
      : [];
    return {
      distanceM: Number(route.distance ?? 0),
      durationS: Number(route.duration ?? 0),
      geometry: route.geometry ? decodePolyline(route.geometry) : null,
      quality: "road",
      legDurations,
    };
  } catch {
    return approximate(capped, mode);
  }
}

/** Build a Google Maps directions URL for the chosen order (external navigation). */
export function googleMapsDirectionsUrl(points: LatLng[], mode: TravelMode): string | null {
  if (points.length < 2) return null;
  const modeParam = mode === "driving" ? "driving" : mode === "cycling" ? "bicycling" : "walking";
  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
  const middle = points.slice(1, -1).slice(0, 9); // Maps caps visible waypoints
  const waypoints = middle.map((p) => `${p.lat},${p.lng}`).join("|");
  const params = new URLSearchParams({ api: "1", origin, destination, travelmode: modeParam });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
