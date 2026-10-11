/** Local mandap directory: search, per-source browsing, detail view, selection. */
import {
  ArrowUpDown,
  Camera,
  Check,
  Clock,
  ExternalLink,
  FileWarning,
  Link2,
  ListPlus,
  Map as MapIcon,
  MapPin,
  Search,
  Sheet as SheetIcon,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyBlock, Sheet } from "@/components/ui";
import { fmtDistance, haversineMeters } from "@/lib/geo";
import { useApp } from "@/state/AppState";
import type { LocationKind, Mandap } from "@/types";
import { cn } from "@/utils/cn";

const KIND_LABEL: Record<LocationKind, string> = {
  columns: "lat/lng columns",
  coords: "coordinates",
  gmaps: "Google Maps link",
  "plus-full": "Plus Code",
  "plus-short": "Plus Code + reference",
  none: "unresolved",
};

type SortMode = "name" | "nearest";

export default function ExploreScreen() {
  const {
    sources,
    mandaps,
    resolvedMandaps,
    unresolvedMandaps,
    filter,
    setFilter,
    selection,
    toggleSelect,
    userPos,
    setTab,
    focusOnMap,
    addDemoSource,
  } = useApp();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [detail, setDetail] = useState<Mandap | null>(null);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = resolvedMandaps;
    if (q) {
      list = list.filter(
        (m) =>
          m.nameKey.includes(q) ||
          m.address.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }
    if (sort === "nearest" && userPos) {
      list = [...list].sort(
        (a, b) =>
          haversineMeters(userPos, { lat: a.lat as number, lng: a.lng as number }) -
          haversineMeters(userPos, { lat: b.lat as number, lng: b.lng as number })
      );
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [resolvedMandaps, query, sort, userPos]);

  /* ---- first run ---- */
  if (mandaps.length === 0) {
    return (
      <div className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-28 pt-4">
        <div className="card relative overflow-hidden">
          <img src="/img/pujo-hero.png" alt="Durga Puja pandal illustration" className="h-44 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#16090d] via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <div className="bangla text-gold-soft/90 text-sm">শারদীয়ার শুভেচ্ছা</div>
            <h1 className="display glow-text text-2xl font-bold text-ink">Plan your pandal trail</h1>
          </div>
        </div>
        <EmptyBlock
          icon={<SheetIcon size={22} />}
          title="Connect your Google Sheet"
          body="Pandal Hop reads mandap names and locations from a Google Sheet you own — coordinates, Google Maps links, or Plus Codes. Everything stays on your device; nothing is uploaded."
          action={
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <button onClick={() => setTab("sources")} className="btn-gold h-11 px-5 text-sm">
                <SheetIcon size={15} /> Connect a sheet
              </button>
              <button onClick={addDemoSource} className="btn-ghost h-11 px-5 text-sm">
                <Sparkles size={15} /> Try sample data
              </button>
            </div>
          }
        />
        <div className="card p-4 text-[12px] leading-relaxed text-ink-faint">
          <span className="text-gold-soft">Expected columns:</span> <code>name</code>, <code>location</code> (or{" "}
          <code>latitude</code> + <code>longitude</code>), and optional <code>address</code>, <code>image_url</code>,{" "}
          <code>facebook_url</code>, <code>opening_hours</code>… Case-insensitive — the importer matches common alias
          headers automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* controls */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mandaps, addresses…"
            className="input !pl-10"
            type="search"
          />
        </div>
        <div className="no-scrollbar mt-2.5 flex items-center gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilter("all")} className={cn("chip h-8", filter === "all" ? "chip-on" : "")}>
            Combined · {mandaps.length}
          </button>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              className={cn("chip h-8", filter === s.id ? "chip-on" : "")}
            >
              {s.kind === "demo" ? <Sparkles size={11} /> : <SheetIcon size={11} />}
              <span className="max-w-[140px] truncate">{s.name}</span>
              <span className="opacity-60">{s.validCount}</span>
            </button>
          ))}
          {userPos && (
            <button
              onClick={() => setSort(sort === "nearest" ? "name" : "nearest")}
              className={cn("chip h-8", sort === "nearest" ? "chip-on" : "")}
            >
              <ArrowUpDown size={11} />
              {sort === "nearest" ? "Nearest first" : "Sort: nearest"}
            </button>
          )}
        </div>
      </div>

      {/* list */}
      <div className="mt-2 flex-1 space-y-2 overflow-y-auto px-4 pb-32">
        {searched.length === 0 && query === "" && resolvedMandaps.length === 0 ? (
          <EmptyBlock
            icon={<MapPin size={22} />}
            title="No mapped mandaps yet"
            body="Records in this view have no usable coordinates. Check the unresolved records below or re-sync the source after fixing the sheet."
          />
        ) : searched.length === 0 ? (
          <EmptyBlock icon={<Search size={22} />} title="No matches" body={`Nothing found for “${query}”.`} />
        ) : (
          searched.map((m) => <MandapCard key={m.id} m={m} onDetail={() => setDetail(m)} />)
        )}

        {unresolvedMandaps.length > 0 && (
          <div className="pt-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-red/80">
              <FileWarning size={13} />
              Needs location fixes · {unresolvedMandaps.length}
            </div>
            <div className="space-y-2">
              {unresolvedMandaps.map((m) => (
                <div key={m.id} className="card border-red/20 bg-red/[0.04] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{m.name}</div>
                      <div className="mt-0.5 text-[11px] text-ink-faint">
                        Sheet row {m.row}
                        {m.locationRaw ? ` · “${m.locationRaw.slice(0, 40)}”` : " · no location value"}
                      </div>
                    </div>
                    <span className="chip border-red/30 text-red">Unmapped</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-dim">
                    Fix this row in Google Sheets (valid coordinates, Maps link, or full Plus Code), then refresh the
                    source. Short Plus Codes also need a reference location set on the source.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MandapDetail
        mandap={detail}
        onClose={() => setDetail(null)}
        onFocusMap={(id) => {
          setDetail(null);
          focusOnMap(id);
        }}
        selection={selection}
        toggleSelect={toggleSelect}
        userPos={userPos}
      />
    </div>
  );
}

function MandapCard({ m, onDetail }: { m: Mandap; onDetail: () => void }) {
  const { selection, toggleSelect, userPos } = useApp();
  const selIdx = selection.indexOf(m.id);
  const selected = selIdx !== -1;
  const d = userPos && m.lat !== null && m.lng !== null ? haversineMeters(userPos, { lat: m.lat, lng: m.lng }) : null;

  return (
    <div
      className={cn(
        "card group relative flex gap-3 p-3 transition-colors",
        selected && "border-gold/50 bg-gold/[0.06]"
      )}
    >
      <button onClick={onDetail} className="min-w-0 flex-1 text-left" aria-label={`Details for ${m.name}`}>
        <div className="truncate text-[14.5px] font-semibold text-ink">{m.name}</div>
        {m.address && <div className="mt-0.5 truncate text-[12px] text-ink-dim">{m.address}</div>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {d !== null && (
            <span className="chip !px-2 !py-0.5 !text-[10.5px]">
              <MapPin size={10} className="text-gold" />
              {fmtDistance(d)}
            </span>
          )}
          {m.openingHours && (
            <span className="chip !px-2 !py-0.5 !text-[10.5px]">
              <Clock size={10} className="text-gold/70" />
              {m.openingHours}
            </span>
          )}
          <span className="chip !px-2 !py-0.5 !text-[10.5px]" title={`Located via ${KIND_LABEL[m.locationKind]}`}>
            {KIND_LABEL[m.locationKind]}
          </span>
        </div>
      </button>
      <button
        onClick={() => toggleSelect(m.id)}
        aria-label={selected ? "Remove from plan" : "Add to plan"}
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center self-center rounded-2xl border transition-all",
          selected
            ? "border-gold bg-gradient-to-b from-gold-soft to-gold-deep text-[#2a1503] shadow-gold"
            : "border-white/10 bg-white/[0.04] text-gold hover:border-gold/50"
        )}
      >
        {selected ? (
          <span className="text-sm font-bold">{selIdx + 1}</span>
        ) : (
          <ListPlus size={17} />
        )}
      </button>
    </div>
  );
}

function MandapDetail({
  mandap,
  onClose,
  onFocusMap,
  selection,
  toggleSelect,
  userPos,
}: {
  mandap: Mandap | null;
  onClose: () => void;
  onFocusMap: (id: string) => void;
  selection: string[];
  toggleSelect: (id: string) => void;
  userPos: { lat: number; lng: number } | null;
}) {
  if (!mandap) return null;
  const selected = selection.includes(mandap.id);
  const gmaps =
    mandap.lat !== null && mandap.lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${mandap.lat},${mandap.lng}`
      : null;
  const d =
    userPos && mandap.lat !== null && mandap.lng !== null
      ? haversineMeters(userPos, { lat: mandap.lat, lng: mandap.lng })
      : null;

  return (
    <Sheet open={!!mandap} onClose={onClose} title={mandap.name}>
      {mandap.imageUrl ? (
        <img
          src={mandap.imageUrl}
          alt={mandap.name}
          loading="lazy"
          className="mb-3 h-40 w-full rounded-xl border border-white/10 object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      ) : null}
      <div className="space-y-3 text-sm">
        {d !== null && (
          <div className="chip w-fit">
            <MapPin size={11} className="text-gold" /> {fmtDistance(d)} from you (straight line)
          </div>
        )}
        {mandap.address && (
          <div>
            <div className="label !mb-1">Address</div>
            <p className="text-ink/90">{mandap.address}</p>
          </div>
        )}
        {mandap.description && (
          <div>
            <div className="label !mb-1">About</div>
            <p className="leading-relaxed text-ink/90">{mandap.description}</p>
          </div>
        )}
        {mandap.openingHours && (
          <div>
            <div className="label !mb-1">Visiting hours</div>
            <p className="text-ink/90">{mandap.openingHours}</p>
          </div>
        )}
        {mandap.locationRaw && (
          <div>
            <div className="label !mb-1">Original location value</div>
            <p className="break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-ink-dim">
              {mandap.locationRaw}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {(mandap.facebookUrl || mandap.instagramUrl) && (
            <>
              {mandap.facebookUrl && (
                <a href={mandap.facebookUrl} target="_blank" rel="noreferrer" className="btn-ghost h-10 px-4 text-xs">
                  <Link2 size={14} /> Facebook
                </a>
              )}
              {mandap.instagramUrl && (
                <a href={mandap.instagramUrl} target="_blank" rel="noreferrer" className="btn-ghost h-10 px-4 text-xs">
                  <Camera size={14} /> Instagram
                </a>
              )}
            </>
          )}
          {gmaps && (
            <a href={gmaps} target="_blank" rel="noreferrer" className="btn-ghost h-10 px-4 text-xs">
              <ExternalLink size={14} /> Open in Google Maps
            </a>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => toggleSelect(mandap.id)}
            className={cn("h-11 flex-1 text-sm", selected ? "btn-danger" : "btn-gold")}
          >
            {selected ? (
              <>
                <Check size={15} /> In your plan — remove
              </>
            ) : (
              <>
                <ListPlus size={15} /> Add to plan
              </>
            )}
          </button>
          {mandap.lat !== null && (
            <button onClick={() => onFocusMap(mandap.id)} className="btn-ghost h-11 px-4 text-sm">
              <MapIcon size={15} /> Map
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
