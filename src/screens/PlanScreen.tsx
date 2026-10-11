/**
 * Route planner: start point + travel mode + user-chosen stops → Web-Worker
 * 2-Opt ordering → routing provider for road estimates → save locally.
 */
import {
  BookmarkPlus,
  Car,
  ChevronDown,
  ChevronUp,
  Crosshair,
  ExternalLink,
  Footprints,
  Info,
  Map as MapIcon,
  RefreshCw,
  Route as RouteIcon,
  Bike,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyBlock, Segmented, Sheet } from "@/components/ui";
import { fmtDistance, fmtDuration } from "@/lib/geo";
import { runOptimizer } from "@/lib/optimize";
import { fetchRoute, googleMapsDirectionsUrl } from "@/lib/routing";
import { useApp } from "@/state/AppState";
import type { LatLng, Mandap, RouteResult, TravelMode } from "@/types";
import { cn } from "@/utils/cn";
import { nanoid } from "nanoid";

type StartMode = "first" | "gps";

const MAX_STOPS = 40;

export default function PlanScreen() {
  const {
    mandaps,
    selection,
    moveSelection,
    toggleSelect,
    clearSelection,
    travelMode,
    setTravelMode,
    userPos,
    geoStatus,
    locateMe,
    setTab,
    setOverlay,
    saveRoute,
    toast,
    online,
  } = useApp();

  const [startMode, setStartMode] = useState<StartMode>("first");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(RouteResult & { signature: string; startLabel: string; start: LatLng | null }) | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [routeName, setRouteName] = useState("");

  const byId = useMemo(() => new Map(mandaps.map((m) => [m.id, m])), [mandaps]);
  const stopMandaps = selection.map((id) => byId.get(id)).filter((m): m is Mandap => !!m);
  const resolvedStops = stopMandaps.filter((m) => m.lat !== null && m.lng !== null);
  const skippedStops = stopMandaps.filter((m) => m.lat === null || m.lng === null);

  const start: LatLng | null = startMode === "gps" && userPos ? userPos : null;
  const signature = `${selection.join("|")}::${travelMode}::${start ? `${start.lat.toFixed(4)},${start.lng.toFixed(4)}` : "first"}`;
  const stale = result !== null && result.signature !== signature;

  const canOptimize = resolvedStops.length >= (start ? 1 : 2) && resolvedStops.length <= MAX_STOPS && !busy;

  async function optimize() {
    if (!canOptimize) return;
    setBusy(true);
    try {
      const nodes = [
        ...(start ? [{ id: "__start", lat: start.lat, lng: start.lng }] : []),
        ...resolvedStops.map((m) => ({ id: m.id, lat: m.lat as number, lng: m.lng as number })),
      ];
      const opt = await runOptimizer(nodes, { pinEnd: false, budgetMs: 2800 });
      const orderIds = opt.order.filter((id) => id !== "__start");
      const points: LatLng[] = [
        ...(start ? [start] : []),
        ...orderIds.map((id) => {
          const m = byId.get(id) as Mandap;
          return { lat: m.lat as number, lng: m.lng as number };
        }),
      ];
      const route = await fetchRoute(points, travelMode);
      setResult({
        orderIds,
        distanceM: route.distanceM,
        durationS: route.durationS,
        quality: route.quality,
        geometry: route.geometry,
        legDurations: route.legDurations,
        signature,
        start,
        startLabel: start ? "Your location" : byId.get(orderIds[0])?.name || "First stop",
      });
      if (route.quality === "approx") {
        toast(
          online
            ? "Routing provider unreachable — showing straight-line estimates. Retry later for road estimates."
            : "Offline — estimates use straight-line distances.",
          "info"
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function openInGoogleMaps() {
    if (!result) return;
    const points: LatLng[] = [
      ...(result.start ? [result.start] : []),
      ...result.orderIds.map((id) => {
        const m = byId.get(id) as Mandap;
        return { lat: m.lat as number, lng: m.lng as number };
      }),
    ];
    const url = googleMapsDirectionsUrl(points, travelMode);
    if (url) window.open(url, "_blank", "noopener");
  }

  function showOnMap() {
    if (!result) return;
    setOverlay({
      geometry: result.geometry,
      orderIds: result.orderIds,
      start: result.start,
      startLabel: result.startLabel,
      quality: result.quality,
      distanceM: result.distanceM,
      durationS: result.durationS,
    });
    setTab("map");
  }

  async function confirmSave() {
    if (!result) return;
    const name =
      routeName.trim() ||
      `Pujo route · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    await saveRoute({
      id: `route-${nanoid(8)}`,
      name,
      mandapIds: result.orderIds,
      order: result.orderIds,
      startLabel: result.startLabel,
      start: result.start,
      travelMode,
      distanceM: result.distanceM,
      durationS: result.durationS,
      quality: result.quality,
      geometry: result.geometry,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setSaveOpen(false);
    setRouteName("");
  }

  if (mandaps.length === 0) {
    return (
      <div className="h-full overflow-y-auto px-4 pb-28 pt-4">
        <EmptyBlock
          icon={<RouteIcon size={22} />}
          title="Nothing to plan yet"
          body="Connect a Google Sheet (or load the sample dataset) from the Sources tab, then pick the mandaps you want to visit here."
          action={
            <button onClick={() => setTab("sources")} className="btn-gold h-11 px-5 text-sm">
              Go to Sources
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto px-4 pb-32 pt-4">
      {/* start + mode */}
      <div className="card space-y-3 p-4">
        <div>
          <div className="label">Start from</div>
          <Segmented<StartMode>
            value={startMode}
            onChange={(v) => {
              setStartMode(v);
              if (v === "gps" && !userPos) locateMe();
            }}
            options={[
              {
                value: "first",
                label: (
                  <>
                    <RouteIcon size={13} /> First stop
                  </>
                ),
              },
              {
                value: "gps",
                label: (
                  <>
                    <Crosshair size={13} /> My location
                  </>
                ),
              },
            ]}
          />
          {startMode === "gps" && (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2 text-[12px]">
              {userPos ? (
                <span className="text-jade">
                  GPS · {userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)}
                </span>
              ) : (
                <span className="text-ink-dim">
                  {geoStatus === "busy" ? "Locating…" : "Location not available yet"}
                </span>
              )}
              <button onClick={locateMe} className="text-gold text-[11px] font-semibold uppercase tracking-wide">
                Refresh
              </button>
            </div>
          )}
        </div>
        <div>
          <div className="label">Travel mode</div>
          <Segmented<TravelMode>
            value={travelMode}
            onChange={setTravelMode}
            options={[
              {
                value: "walking",
                label: (
                  <>
                    <Footprints size={13} /> Walk
                  </>
                ),
              },
              {
                value: "cycling",
                label: (
                  <>
                    <Bike size={13} /> Cycle
                  </>
                ),
              },
              {
                value: "driving",
                label: (
                  <>
                    <Car size={13} /> Drive
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* stops */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold text-gold-soft">
            Your stops <span className="text-sm font-normal text-ink-faint">· {stopMandaps.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            {stopMandaps.length > 0 && (
              <button onClick={clearSelection} className="btn-ghost h-8 px-3 !text-[11px]">
                <Trash2 size={12} /> Clear
              </button>
            )}
            <button onClick={() => setTab("explore")} className="btn-ghost h-8 px-3 !text-[11px]">
              + Add mandaps
            </button>
          </div>
        </div>

        {stopMandaps.length === 0 ? (
          <EmptyBlock
            icon={<RouteIcon size={22} />}
            title="Pick your mandaps"
            body="You choose exactly which pandals to visit — nothing is auto-added. Browse the Explore tab or the map and tap “Add to plan”."
            action={
              <button onClick={() => setTab("explore")} className="btn-ghost h-11 px-5 text-sm">
                Browse directory
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {stopMandaps.map((m, i) => {
              const unresolved = m.lat === null || m.lng === null;
              return (
                <div
                  key={m.id}
                  className={cn("card flex items-center gap-3 p-3", unresolved && "border-red/25 bg-red/[0.04]")}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                      unresolved ? "bg-red/20 text-red" : "bg-gold/15 text-gold-soft"
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{m.name}</div>
                    <div className="truncate text-[11px] text-ink-dim">
                      {unresolved ? "No coordinates — will be skipped" : m.address || "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button
                      onClick={() => moveSelection(m.id, -1)}
                      disabled={i === 0}
                      className="grid h-8 w-7 place-items-center text-ink-dim hover:text-gold disabled:opacity-25"
                      aria-label="Move up"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => moveSelection(m.id, 1)}
                      disabled={i === stopMandaps.length - 1}
                      className="grid h-8 w-7 place-items-center text-ink-dim hover:text-gold disabled:opacity-25"
                      aria-label="Move down"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      onClick={() => toggleSelect(m.id)}
                      className="grid h-8 w-7 place-items-center text-ink-dim hover:text-red"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {stopMandaps.length > MAX_STOPS && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-red">
            <Info size={13} /> Keep at most {MAX_STOPS} stops for a responsive optimization.
          </p>
        )}
        {skippedStops.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-gold-soft/80">
            <Info size={13} /> {skippedStops.length} selected record{skippedStops.length === 1 ? "" : "s"} without
            coordinates will be skipped. Fix them in your sheet and refresh.
          </p>
        )}
      </div>

      {/* optimize CTA */}
      <button onClick={optimize} disabled={!canOptimize && !busy} className="btn-gold h-14 w-full text-[15px] font-bold">
        {busy ? (
          <>
            <RefreshCw size={17} className="animate-spin" /> Optimizing your trail…
          </>
        ) : (
          <>
            <RouteIcon size={17} />
            {result && !stale ? "Re-optimize route" : `Optimize ${resolvedStops.length}-stop route`}
          </>
        )}
      </button>
      {stale && result && (
        <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-gold-soft/80">
          <Info size={13} /> Selection changed — re-optimize to refresh the estimate.
        </p>
      )}

      {/* result */}
      {result && !stale && (
        <div className="card animate-rise overflow-hidden">
          <div className="border-b border-white/[0.06] bg-gradient-to-r from-maroon/40 to-transparent px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="display text-lg font-semibold text-ink">
                {fmtDistance(result.distanceM)} · {fmtDuration(result.durationS)}
              </div>
              <span className={cn("chip !text-[10px]", result.quality === "road" ? "border-jade/40 text-jade" : "border-gold/40 text-gold-soft")}>
                {result.quality === "road" ? "Road estimate · OSRM" : "Approximate · straight-line"}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-ink-dim">
              {travelMode === "driving" ? "Driving" : travelMode === "cycling" ? "Cycling" : "Walking"} from{" "}
              {result.startLabel}. Heuristic 2-Opt order — verify timings on the day.
            </div>
          </div>
          <ol className="divide-y divide-white/[0.05] px-4">
            {result.orderIds.map((id, i) => {
              const m = byId.get(id);
              if (!m) return null;
              const legIdx = result.start ? i : i - 1;
              const leg = legIdx >= 0 ? result.legDurations[legIdx] : undefined;
              return (
                <li key={id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-[11px] font-bold text-[#2a1503]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{m.name}</div>
                    {leg !== undefined && (
                      <div className="text-[11px] text-ink-faint">+{fmtDuration(leg)} from previous</div>
                    )}
                  </div>
                  {i === 0 && <span className="chip !text-[10px]">start here</span>}
                </li>
              );
            })}
          </ol>
          <div className="flex gap-2 border-t border-white/[0.06] p-3">
            <button
              onClick={() => {
                setRouteName("");
                setSaveOpen(true);
              }}
              className="btn-gold h-11 flex-1 text-sm"
            >
              <BookmarkPlus size={15} /> Save
            </button>
            <button onClick={showOnMap} className="btn-ghost h-11 px-4 text-sm">
              <MapIcon size={15} /> Map
            </button>
            <button onClick={openInGoogleMaps} className="btn-ghost h-11 px-4 text-sm">
              <ExternalLink size={15} /> Navigate
            </button>
          </div>
        </div>
      )}

      {/* save dialog */}
      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title="Save route">
        <div className="space-y-3">
          <div>
            <label className="label">Route name</label>
            <input
              autoFocus
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g. Shashthi evening — Dhanmondi trail"
              className="input"
              maxLength={80}
            />
          </div>
          <p className="text-[12px] leading-relaxed text-ink-faint">
            <span className="text-gold-soft/80">{result?.orderIds.length ?? 0} stops</span> · saved only on this
            device (IndexedDB) — fully available offline, no account needed.
          </p>
          <button onClick={confirmSave} className="btn-gold h-12 w-full text-sm font-semibold">
            Save to this device
          </button>
        </div>
      </Sheet>
    </div>
  );
}
