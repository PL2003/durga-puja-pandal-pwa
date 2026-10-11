/** Saved routes: reopen offline, view order, rename, delete, re-plan, navigate. */
import {
  Bookmark,
  Car,
  ChevronDown,
  ExternalLink,
  Footprints,
  Map as MapIcon,
  Pencil,
  Route as RouteIcon,
  Bike,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyBlock, Sheet } from "@/components/ui";
import { fmtDistance, fmtDuration } from "@/lib/geo";
import { googleMapsDirectionsUrl } from "@/lib/routing";
import { useApp } from "@/state/AppState";
import type { LatLng, Mandap, SavedRoute } from "@/types";
import { cn } from "@/utils/cn";

const MODE_ICON = { walking: Footprints, cycling: Bike, driving: Car };

export default function RoutesScreen() {
  const { routes, mandaps, removeRoute, saveRoute, setTab, setOverlay, toast, setSelectionIds } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const byId = useMemo(() => new Map(mandaps.map((m) => [m.id, m])), [mandaps]);

  function routePoints(route: SavedRoute): LatLng[] {
    return [
      ...(route.start ? [route.start] : []),
      ...route.order
        .map((id) => byId.get(id))
        .filter((m): m is Mandap => !!m && m.lat !== null && m.lng !== null)
        .map((m) => ({ lat: m.lat as number, lng: m.lng as number })),
    ];
  }

  function reopenInPlanner(route: SavedRoute) {
    // Load the saved order back into the planner selection for adjustment.
    const available = route.order.filter((id) => byId.has(id));
    if (available.length === 0) {
      toast("These mandaps are no longer in your synced sheets.", "err");
      return;
    }
    setSelectionIds(available);
    setTab("plan");
    toast("Route loaded into the planner — re-optimize to refresh estimates.", "ok");
  }

  function showOnMap(route: SavedRoute) {
    setOverlay({
      geometry: route.geometry,
      orderIds: route.order,
      start: route.start,
      startLabel: route.startLabel,
      quality: route.quality,
      distanceM: route.distanceM,
      durationS: route.durationS,
    });
    setTab("map");
  }

  function navigate(route: SavedRoute) {
    const url = googleMapsDirectionsUrl(routePoints(route), route.travelMode);
    if (url) window.open(url, "_blank", "noopener");
    else toast("Not enough coordinates to build directions.", "err");
  }

  if (routes.length === 0) {
    return (
      <div className="h-full overflow-y-auto px-4 pb-28 pt-4">
        <EmptyBlock
          icon={<Bookmark size={22} />}
          title="No saved routes yet"
          body="Optimize a trail in the Plan tab, then save it — saved routes live in IndexedDB on this device and open fully offline."
          action={
            <button onClick={() => setTab("plan")} className="btn-gold h-11 px-5 text-sm">
              <RouteIcon size={15} /> Plan a route
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full space-y-2.5 overflow-y-auto px-4 pb-32 pt-4">
      {routes.map((r) => {
        const IconC = MODE_ICON[r.travelMode];
        const open = openId === r.id;
        const missing = r.order.filter((id) => !byId.has(id)).length;
        return (
          <div key={r.id} className="card overflow-hidden">
            <button onClick={() => setOpenId(open ? null : r.id)} className="w-full p-4 text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="display truncate text-[16px] font-semibold text-ink">{r.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-dim">
                    <span className="chip !py-0.5 !text-[10.5px]">
                      <IconC size={11} className="text-gold/80" />
                      {r.travelMode}
                    </span>
                    <span className="chip !py-0.5 !text-[10.5px]">{r.order.length} stops</span>
                    <span className={cn("chip !py-0.5 !text-[10.5px]", r.quality === "approx" && "border-gold/40 text-gold-soft")}>
                      {r.quality === "road" ? "road" : "approx"}
                    </span>
                  </div>
                </div>
                <ChevronDown size={16} className={cn("mt-1 shrink-0 text-ink-dim transition-transform", open && "rotate-180")} />
              </div>
              <div className="mt-2 text-[13px] text-gold-soft">
                {fmtDistance(r.distanceM)} · {fmtDuration(r.durationS)}
                <span className="text-ink-faint"> · from {r.startLabel}</span>
              </div>
            </button>
            {open && (
              <div className="animate-fade border-t border-white/[0.06] px-4 pb-4 pt-3">
                {missing > 0 && (
                  <p className="mb-2 text-[11.5px] text-gold-soft/80">
                    {missing} stop{missing === 1 ? "" : "s"} no longer exist in your synced sheets.
                  </p>
                )}
                <ol className="mb-3 space-y-1.5">
                  {r.order.map((id, i) => {
                    const m = byId.get(id);
                    return (
                      <li key={`${id}-${i}`} className="flex items-center gap-2.5 text-[13px]">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 text-[10px] font-bold text-gold-soft">
                          {i + 1}
                        </span>
                        <span className={cn("truncate", m ? "text-ink" : "text-ink-faint line-through")}>
                          {m ? m.name : "Removed from sheet"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => reopenInPlanner(r)} className="btn-gold h-10 flex-1 !text-xs">
                    <RouteIcon size={13} /> Re-plan
                  </button>
                  <button onClick={() => showOnMap(r)} className="btn-ghost h-10 px-3 !text-xs">
                    <MapIcon size={13} /> Map
                  </button>
                  <button onClick={() => navigate(r)} className="btn-ghost h-10 px-3 !text-xs">
                    <ExternalLink size={13} /> Navigate
                  </button>
                  <button
                    onClick={() => {
                      setRenameId(r.id);
                      setNameDraft(r.name);
                    }}
                    className="btn-ghost h-10 px-3 !text-xs"
                  >
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleteId(r.id)} className="btn-danger h-10 px-3 !text-xs">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* rename */}
      <Sheet open={renameId !== null} onClose={() => setRenameId(null)} title="Rename route">
        <div className="space-y-3">
          <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="input" maxLength={80} />
          <button
            onClick={async () => {
              const r = routes.find((x) => x.id === renameId);
              if (r) await saveRoute({ ...r, name: nameDraft.trim() || r.name, updatedAt: Date.now() });
              setRenameId(null);
            }}
            className="btn-gold h-11 w-full text-sm"
          >
            Save name
          </button>
        </div>
      </Sheet>

      {/* delete */}
      <Sheet open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete route?">
        <p className="text-sm text-ink-dim">This removes the saved route from this device. Your sheets are untouched.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setDeleteId(null)} className="btn-ghost h-11 flex-1 text-sm">
            Keep
          </button>
          <button
            onClick={async () => {
              if (deleteId) await removeRoute(deleteId);
              setDeleteId(null);
            }}
            className="btn-danger h-11 flex-1 text-sm"
          >
            Delete
          </button>
        </div>
      </Sheet>
    </div>
  );
}
