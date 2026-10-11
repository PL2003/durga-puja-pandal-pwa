/** Full-bleed interactive map with nearby search and selection strip. */
import { Crosshair, ListPlus, MapPin, Navigation, Route, X } from "lucide-react";
import { useMemo, useState } from "react";
import MapView from "@/components/MapView";
import { Sheet } from "@/components/ui";
import { fmtDistance, haversineMeters } from "@/lib/geo";
import { useApp } from "@/state/AppState";
import type { Mandap } from "@/types";
import { cn } from "@/utils/cn";

export default function MapScreen() {
  const {
    resolvedMandaps,
    selection,
    toggleSelect,
    setTab,
    userPos,
    geoStatus,
    locateMe,
    mapFocusId,
    focusOnMap,
    overlay,
    toast,
  } = useApp();
  const [picked, setPicked] = useState<Mandap | null>(null);
  const [nearbyOpen, setNearbyOpen] = useState(false);

  const selectedMandaps = useMemo(
    () =>
      selection
        .map((id) => resolvedMandaps.find((m) => m.id === id))
        .filter((m): m is Mandap => !!m),
    [selection, resolvedMandaps]
  );

  const nearby = useMemo(() => {
    if (!userPos) return [];
    return [...resolvedMandaps]
      .map((m) => ({ m, d: haversineMeters(userPos, { lat: m.lat as number, lng: m.lng as number }) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
  }, [resolvedMandaps, userPos]);

  const pickedDistance =
    picked && userPos && picked.lat !== null && picked.lng !== null
      ? haversineMeters(userPos, { lat: picked.lat, lng: picked.lng })
      : null;

  return (
    <div className="relative h-full">
      <MapView
        mandaps={resolvedMandaps}
        selection={selection}
        routeGeometry={overlay?.geometry ?? null}
        routeOrder={overlay?.orderIds}
        start={overlay?.start ?? null}
        userPos={userPos}
        focusId={mapFocusId}
        onFocusDone={() => focusOnMap(null)}
        onPick={(m) => setPicked(m)}
        onTileFallback={(name) =>
          toast(`Map tiles switched to ${name} — no API key is ever needed.`, "info")
        }
        className="absolute inset-0"
      />

      {/* top overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between gap-2 p-3 pt-safe">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#16090d]/85 px-4 py-2.5 shadow-xl backdrop-blur">
          <div className="display text-sm font-semibold text-gold-soft">
            {resolvedMandaps.length} mapped mandap{resolvedMandaps.length === 1 ? "" : "s"}
          </div>
          <div className="text-[11px] text-ink-dim">
            {selection.length > 0 ? `${selection.length} selected for your route` : "Tap any pin to preview"}
          </div>
        </div>
        <button
          onClick={() => setNearbyOpen(true)}
          className="pointer-events-auto btn-ghost h-11 gap-1.5 px-4 !rounded-2xl text-xs shadow-xl"
        >
          <Navigation size={14} className="text-gold" />
          Nearby
        </button>
      </div>

      {/* locate FAB */}
      <button
        onClick={locateMe}
        aria-label="Locate me"
        className={cn(
          "absolute bottom-[172px] right-3 z-[500] grid h-12 w-12 place-items-center rounded-2xl border shadow-xl backdrop-blur transition-colors",
          userPos ? "border-sky/50 bg-sky/15 text-sky" : "border-white/10 bg-[#16090d]/85 text-gold"
        )}
      >
        <Crosshair size={18} className={geoStatus === "busy" ? "animate-spin" : ""} />
      </button>

      {/* picked mandap card */}
      {picked ? (
        <div className="absolute inset-x-3 bottom-3 z-[500] animate-rise">
          <div className="card-raise relative overflow-hidden p-4">
            <button
              onClick={() => setPicked(null)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/30 text-ink-dim hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
            <div className="pr-8">
              <div className="display text-[17px] font-semibold leading-tight text-ink">{picked.name}</div>
              {picked.address && (
                <div className="mt-1 flex items-start gap-1.5 text-xs text-ink-dim">
                  <MapPin size={12} className="mt-0.5 shrink-0 text-gold/70" />
                  <span>{picked.address}</span>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {pickedDistance !== null && <span className="chip">{fmtDistance(pickedDistance)} away</span>}
                {picked.openingHours && <span className="chip">{picked.openingHours}</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => toggleSelect(picked.id)}
                  className={cn("h-10 flex-1 text-sm", selection.includes(picked.id) ? "btn-danger" : "btn-gold")}
                >
                  {selection.includes(picked.id) ? (
                    <>
                      <X size={15} /> Remove
                    </>
                  ) : (
                    <>
                      <ListPlus size={15} /> Add to plan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : selection.length > 0 ? (
        /* selection strip */
        <div className="absolute inset-x-3 bottom-3 z-[500] animate-rise">
          <div className="card-raise flex items-center gap-2 p-2.5">
            <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto px-1">
              {selectedMandaps.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => toggleSelect(m.id)}
                  className="chip chip-on !py-1.5 !text-[11px]"
                  title="Remove"
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-gold text-[9px] font-bold text-[#2a1503]">
                    {i + 1}
                  </span>
                  <span className="max-w-[110px] truncate">{m.name}</span>
                  <X size={11} className="opacity-60" />
                </button>
              ))}
            </div>
            <button onClick={() => setTab("plan")} className="btn-gold h-11 shrink-0 px-4 text-xs">
              <Route size={15} />
              Plan
            </button>
          </div>
        </div>
      ) : null}

      {/* Nearby sheet */}
      <Sheet open={nearbyOpen} onClose={() => setNearbyOpen(false)} title="Nearby mandaps">
        {!userPos ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-ink-dim">
              Share your location to find the closest mandaps, measured straight-line from your device.
            </p>
            <button onClick={locateMe} className="btn-gold h-11 px-5 text-sm">
              <Crosshair size={15} /> Use my location
            </button>
          </div>
        ) : nearby.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-dim">No mapped mandaps yet — sync a sheet first.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {nearby.map(({ m, d }) => (
              <div key={m.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{m.name}</div>
                  <div className="truncate text-[11px] text-ink-dim">{m.address || "—"}</div>
                </div>
                <span className="chip shrink-0">{fmtDistance(d)}</span>
                <button
                  onClick={() => toggleSelect(m.id)}
                  className={cn("h-9 rounded-full px-3 text-xs", selection.includes(m.id) ? "btn-danger" : "btn-gold")}
                >
                  {selection.includes(m.id) ? "Added" : "Add"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
