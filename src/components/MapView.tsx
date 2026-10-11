/** Reusable Leaflet map: gold pins, numbered selection pins, route polyline, user dot. */
import L from "leaflet";
import { useEffect, useRef } from "react";
import { boundsOf } from "@/lib/geo";
import { getTileProviders } from "@/lib/tiles";
import type { LatLng, Mandap } from "@/types";

interface MapViewProps {
  mandaps: Mandap[];
  selection: string[];
  routeGeometry?: [number, number][] | null;
  routeOrder?: string[];
  start?: LatLng | null;
  startLabel?: string;
  userPos?: LatLng | null;
  focusId?: string | null;
  onFocusDone?: () => void;
  onPick?: (m: Mandap) => void;
  /** Called when the tile layer auto-switches to a fallback (keyless) provider. */
  onTileFallback?: (providerName: string) => void;
  className?: string;
  interactive?: boolean;
}

function pinIcon(html: string, anchor: [number, number] = [15, 26]): L.DivIcon {
  return L.divIcon({ className: "", html, iconSize: [30, 30], iconAnchor: anchor });
}

function markerHtml(kind: "plain" | "num" | "start", num?: number): string {
  if (kind === "start") {
    return `<div class="ph-pin ph-pin--start"><span class="ph-pin__num">S</span></div>`;
  }
  if (kind === "num") {
    return `<div class="ph-pin"><span class="ph-pin__num">${num}</span></div>`;
  }
  return `<div class="ph-pin ph-pin--faint"><span class="ph-pin__num"></span></div>`;
}

export default function MapView({
  mandaps,
  selection,
  routeGeometry,
  routeOrder,
  start,
  startLabel,
  userPos,
  focusId,
  onFocusDone,
  onPick,
  onTileFallback,
  className,
  interactive = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup>(L.layerGroup());
  const routeLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const meLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const fittedOnce = useRef(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const fallbackRef = useRef(onTileFallback);
  fallbackRef.current = onTileFallback;
  const orderKey = (routeOrder || []).join(",");

  /* init once — with keyless tile-provider fallback */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const map = L.map(el, {
      center: [23.7808, 90.4071],
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });

    const providers = getTileProviders();
    let providerIdx = 0;
    let errorCount = 0;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    let layer: L.TileLayer | null = null;

    const addProvider = (idx: number) => {
      const p = providers[idx];
      const next = L.tileLayer(p.url, {
        attribution: p.attribution,
        maxZoom: p.maxZoom,
        subdomains: p.subdomains,
      });
      next.on("tileerror", () => {
        errorCount++;
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          errorCount = 0;
        }, 15000);
        // Swap only when many tiles fail while actually online — transient
        // single-tile errors and offline mode must not trigger fallback.
        if (errorCount >= 10 && navigator.onLine && providerIdx < providers.length - 1) {
          providerIdx++;
          if (layer) map.removeLayer(layer);
          addProvider(providerIdx);
          fallbackRef.current?.(providers[providerIdx].name);
        }
      });
      next.addTo(map);
      layer = next;
    };
    addProvider(0);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    markersRef.current.addTo(map);
    routeLayerRef.current.addTo(map);
    meLayerRef.current.addTo(map);
    mapRef.current = map;
    return () => {
      if (resetTimer) clearTimeout(resetTimer);
      map.remove();
      mapRef.current = null;
      fittedOnce.current = false;
    };
  }, []);

  /* markers */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = markersRef.current;
    layer.clearLayers();
    const selIndex = new Map(selection.map((id, i) => [id, i]));
    const orderIndex = new Map((routeOrder || []).map((id, i) => [id, i]));

    for (const m of mandaps) {
      if (m.lat === null || m.lng === null) continue;
      const rIdx = orderIndex.get(m.id);
      const sIdx = selIndex.get(m.id);
      const html =
        rIdx !== undefined
          ? markerHtml("num", rIdx + 1)
          : sIdx !== undefined
            ? markerHtml("num", sIdx + 1)
            : markerHtml("plain");
      const marker = L.marker([m.lat, m.lng], { icon: pinIcon(html), keyboard: false });
      marker.on("click", () => pickRef.current?.(m));
      layer.addLayer(marker);
    }

    if (start) {
      const startMarker = L.marker([start.lat, start.lng], {
        icon: pinIcon(markerHtml("start")),
        keyboard: false,
      });
      layer.addLayer(startMarker);
    }

    if (!fittedOnce.current) {
      const pts: LatLng[] = mandaps
        .filter((m) => m.lat !== null && m.lng !== null)
        .map((m) => ({ lat: m.lat as number, lng: m.lng as number }));
      if (pts.length === 1) {
        map.setView([pts[0].lat, pts[0].lng], 14);
        fittedOnce.current = true;
      } else if (pts.length > 1) {
        const b = boundsOf(pts);
        if (b) {
          map.fitBounds(b, { padding: [46, 46], maxZoom: 15 });
          fittedOnce.current = true;
        }
      }
    }
  }, [mandaps, selection, orderKey, start, routeOrder]);

  /* route geometry */
  useEffect(() => {
    const layer = routeLayerRef.current;
    layer.clearLayers();
    if (!routeGeometry || routeGeometry.length < 2) return;
    L.polyline(routeGeometry, { color: "#0d0709", weight: 7, opacity: 0.85 }).addTo(layer);
    L.polyline(routeGeometry, { color: "#ecc16a", weight: 3.5, opacity: 0.95, dashArray: "1 6", lineCap: "round" }).addTo(layer);
    const b = L.latLngBounds(routeGeometry);
    mapRef.current?.fitBounds(b, { padding: [52, 52], maxZoom: 15 });
  }, [routeGeometry]);

  /* user position */
  useEffect(() => {
    const layer = meLayerRef.current;
    layer.clearLayers();
    if (!userPos) return;
    const icon = L.divIcon({ className: "", html: `<div class="ph-me"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
    L.marker([userPos.lat, userPos.lng], { icon, interactive: false }).addTo(layer);
    L.circle([userPos.lat, userPos.lng], {
      radius: 60,
      color: "#7fb3d5",
      weight: 1,
      opacity: 0.5,
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(layer);
  }, [userPos]);

  /* fly to a focused mandap */
  useEffect(() => {
    if (!focusId) return;
    const map = mapRef.current;
    const m = mandaps.find((x) => x.id === focusId);
    if (map && m && m.lat !== null && m.lng !== null) {
      map.flyTo([m.lat, m.lng], Math.max(map.getZoom(), 16), { duration: 0.9 });
      pickRef.current?.(m);
    }
    onFocusDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  if (!interactive) {
    return <div ref={containerRef} className={className} style={{ pointerEvents: "none" }} aria-label={startLabel || "Map"} />;
  }
  return <div ref={containerRef} className={className} aria-label={startLabel || "Interactive map"} />;
}
