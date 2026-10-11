/**
 * Data Sources: user-owned Google Sheets are the only upstream. Everything
 * imported stays in this device's IndexedDB — nothing leaves the phone.
 */
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sheet as SheetIcon,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyBlock, Sheet } from "@/components/ui";
import { parseDecimalPair, validLatLng } from "@/lib/location";
import { parseSheetUrl } from "@/lib/sheets";
import { fmtTime } from "@/lib/geo";
import { useApp } from "@/state/AppState";
import type { ImportIssue, SourceMeta, SyncStatus } from "@/types";
import { cn } from "@/utils/cn";

const STATUS_META: Record<SyncStatus, { label: string; cls: string }> = {
  idle: { label: "Not synced yet", cls: "text-ink-dim border-white/10" },
  syncing: { label: "Synchronizing…", cls: "text-gold-soft border-gold/40 animate-pulse-soft" },
  ok: { label: "Up to date", cls: "text-jade border-jade/30" },
  "sync-failed": { label: "Last sync failed", cls: "text-red border-red/30" },
  invalid: { label: "Invalid spreadsheet", cls: "text-red border-red/30" },
  "confirm-empty": { label: "Review needed", cls: "text-gold-soft border-gold/40" },
};

export default function SourcesScreen() {
  const {
    sources,
    online,
    syncOne,
    addGoogleSource,
    addDemoSource,
    removeSource,
    renameSource,
    setSourceRefs,
    setFilter,
    setTab,
    loadIssues,
    toast,
  } = useApp();

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [refText, setRefText] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const [issuesFor, setIssuesFor] = useState<{ source: SourceMeta; issues: ImportIssue[] } | null>(null);
  const [renameFor, setRenameFor] = useState<SourceMeta | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [refFor, setRefFor] = useState<SourceMeta | null>(null);
  const [refDraft, setRefDraft] = useState("");
  const [deleteFor, setDeleteFor] = useState<SourceMeta | null>(null);
  const [confirmWipe, setConfirmWipe] = useState<SourceMeta | null>(null);

  const parsed = useMemo(() => parseSheetUrl(url), [url]);
  const hasDemo = sources.some((s) => s.kind === "demo");

  async function connect() {
    setFormError(null);
    const ref = parseSheetUrl(url);
    if (!ref.ok) {
      setFormError(ref.message || "Invalid link.");
      return;
    }
    let refLat: number | null = null;
    let refLng: number | null = null;
    if (refText.trim()) {
      const p = parseDecimalPair(refText.trim());
      if (!p || !validLatLng(p.lat, p.lng)) {
        setFormError("The reference location must be decimal coordinates like “23.7808, 90.4071”.");
        return;
      }
      refLat = p.lat;
      refLng = p.lng;
    }
    setBusy(true);
    const { outcome, error } = await addGoogleSource({ url, name, refLat, refLng });
    setBusy(false);
    if (error) {
      setFormError(error);
      return;
    }
    if (!outcome) {
      setFormError("Could not add the source.");
      return;
    }
    if (outcome.kind === "ok") {
      setUrl("");
      setName("");
      setRefText("");
      toast(
        `Imported ${outcome.meta.validCount} mandap${outcome.meta.validCount === 1 ? "" : "s"} from “${outcome.meta.name}”.`,
        "ok"
      );
      if (outcome.issues.length > 0) setIssuesFor({ source: outcome.meta, issues: outcome.issues });
    } else if (outcome.kind === "invalid") {
      setIssuesFor({ source: outcome.meta, issues: outcome.issues });
      setFormError(outcome.error);
    } else if (outcome.kind === "failed") {
      setFormError(outcome.error);
    } else if (outcome.kind === "needs-confirm") {
      setConfirmWipe(outcome.meta);
    }
  }

  async function refresh(src: SourceMeta) {
    if (!online) {
      toast("You are offline — sync will retry automatically when you reconnect.", "info");
      return;
    }
    const outcome = await syncOne(src.id, { force: true });
    if (!outcome) return;
    if (outcome.kind === "ok") {
      if (outcome.added === 0 && outcome.updated === 0 && outcome.removed === 0) {
        toast(`“${src.name}” is already up to date.`, "ok");
      } else {
        toast(`“${src.name}” — ${outcome.added} added, ${outcome.updated} updated, ${outcome.removed} removed.`, "ok");
      }
      if (outcome.issues.length > 0) setIssuesFor({ source: outcome.meta, issues: outcome.issues });
    } else if (outcome.kind === "needs-confirm") {
      setConfirmWipe(outcome.meta);
    } else if (outcome.kind === "invalid") {
      setIssuesFor({ source: outcome.meta, issues: outcome.issues });
      toast(`Structure problem in “${src.name}”. Kept the previous data.`, "err");
    } else if (outcome.kind === "failed") {
      toast(outcome.error, "err");
    } else {
      toast(`“${src.name}” is unchanged.`, "info");
    }
  }

  async function confirmWipeNow() {
    if (!confirmWipe) return;
    const outcome = await syncOne(confirmWipe.id, { force: true, allowEmpty: true });
    setConfirmWipe(null);
    if (outcome?.kind === "ok") toast(`Replaced “${confirmWipe.name}” with the new (empty) sheet.`, "ok");
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto px-4 pb-32 pt-4">
      {/* privacy note */}
      <div className="card flex items-start gap-3 border-jade/15 p-3.5">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-jade" />
        <p className="text-[12px] leading-relaxed text-ink-dim">
          <span className="font-semibold text-ink">Local-first & private.</span> Sheets are fetched directly from Google
          by your browser; imported records and routes never leave this device. There is no central mandap database.
        </p>
      </div>

      {/* add form */}
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="display text-[17px] font-semibold text-gold-soft">Connect a Google Sheet</h2>
          <button onClick={() => setGuideOpen(true)} className="btn-ghost h-8 px-3 !text-[11px]">
            Format guide
          </button>
        </div>
        <div>
          <label className="label">Spreadsheet link</label>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setFormError(null);
            }}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="input font-mono !text-[12px]"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
          />
          {url.trim() && parsed.ok && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-jade">
              <CheckCircle2 size={12} />
              {parsed.kind === "published" ? "Published sheet" : "Standard sheet"} · id {parsed.sheetId.slice(0, 10)}…
              · tab gid {parsed.gid}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dhanmondi utsab list" className="input" maxLength={60} />
          </div>
          <div>
            <label className="label">Reference for short Plus Codes</label>
            <input
              value={refText}
              onChange={(e) => setRefText(e.target.value)}
              placeholder="23.7808, 90.4071"
              className="input font-mono !text-[12px]"
            />
          </div>
        </div>
        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-red/25 bg-red/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-red">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        <button onClick={connect} disabled={busy || !url.trim()} className="btn-gold h-12 w-full text-sm font-semibold">
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Fetching & validating…
            </>
          ) : (
            <>
              <Plus size={15} /> Connect & import
            </>
          )}
        </button>
        {!hasDemo && (
          <button onClick={addDemoSource} className="btn-ghost h-10 w-full !text-xs">
            <Sparkles size={13} /> Or explore with the local sample dataset
          </button>
        )}
      </div>

      {/* sources list */}
      {sources.length === 0 ? (
        <EmptyBlock
          icon={<SheetIcon size={22} />}
          title="No data sources"
          body="Add a publicly shared Google Sheet above. You can connect several sheets — each keeps its own identity, and you can browse them separately or combined."
        />
      ) : (
        <div className="space-y-2.5">
          {sources.map((s) => {
            const meta = STATUS_META[s.status];
            const syncing = s.status === "syncing";
            return (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {s.kind === "demo" ? (
                        <Sparkles size={15} className="shrink-0 text-gold" />
                      ) : (
                        <FileSpreadsheet size={15} className="shrink-0 text-jade" />
                      )}
                      <span className="display truncate text-[15.5px] font-semibold text-ink">{s.name}</span>
                    </div>
                    <div className="mt-1 truncate font-mono text-[10.5px] text-ink-faint">
                      {s.kind === "demo" ? "bundled locally — offline" : `docs.google.com · sheet ${s.sheetId.slice(0, 8)}… · tab ${s.gid}`}
                    </div>
                  </div>
                  <span className={cn("chip shrink-0 border !text-[10px]", meta.cls)}>
                    {syncing && <Loader2 size={10} className="animate-spin" />}
                    {!online && s.kind === "google-sheet" && <WifiOff size={10} />}
                    {!online && s.kind === "google-sheet" ? "Offline" : meta.label}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-dim">
                  <span>{s.validCount} mandaps</span>
                  {s.issueCount > 0 && (
                    <button
                      onClick={async () => setIssuesFor({ source: s, issues: await loadIssues(s.id) })}
                      className="flex items-center gap-1 text-red"
                    >
                      <AlertTriangle size={11} /> {s.issueCount} rows need fixes
                    </button>
                  )}
                  <span>Synced {fmtTime(s.lastSyncAt)}</span>
                  <span className="text-ink-faint">v{s.datasetVersion}</span>
                </div>
                {s.lastError && <p className="mt-1.5 text-[11.5px] leading-snug text-red/90">{s.lastError}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {s.kind === "google-sheet" && (
                    <button onClick={() => refresh(s)} disabled={syncing} className="btn-gold h-9 px-3.5 !text-[11.5px]">
                      <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> Refresh now
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setFilter(s.id);
                      setTab("explore");
                    }}
                    className="btn-ghost h-9 px-3.5 !text-[11.5px]"
                  >
                    Browse
                  </button>
                  <button
                    onClick={() => {
                      setRenameFor(s);
                      setRenameDraft(s.name);
                    }}
                    className="btn-ghost h-9 px-3.5 !text-[11.5px]"
                  >
                    <Pencil size={12} /> Rename
                  </button>
                  <button
                    onClick={() => {
                      setRefFor(s);
                      setRefDraft(s.refLat !== null && s.refLng !== null ? `${s.refLat}, ${s.refLng}` : "");
                    }}
                    className="btn-ghost h-9 px-3.5 !text-[11.5px]"
                  >
                    <Crosshair size={12} /> Reference
                  </button>
                  <button onClick={() => setDeleteFor(s)} className="btn-danger h-9 px-3.5 !text-[11.5px]">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* issues sheet */}
      <Sheet open={!!issuesFor} onClose={() => setIssuesFor(null)} title={issuesFor ? `Rows needing attention — ${issuesFor.source.name}` : ""} wide>
        {issuesFor && issuesFor.issues.length === 0 ? (
          <p className="py-4 text-center text-sm text-jade">Every row imported cleanly.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] leading-relaxed text-ink-dim">
              These rows were not silently dropped — fix them in Google Sheets and tap <span className="text-gold-soft">Refresh now</span>.
            </p>
            {issuesFor?.issues.map((iss, i) => (
              <div key={i} className="card border-red/15 p-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-red/90">
                  <AlertTriangle size={11} />
                  Row {iss.row} · {iss.code}
                </div>
                <div className="mt-1 truncate text-[13px] font-medium text-ink">{iss.name || iss.field}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">{iss.message}</p>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {/* rename */}
      <Sheet open={!!renameFor} onClose={() => setRenameFor(null)} title="Rename source">
        <div className="space-y-3">
          <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} className="input" maxLength={60} />
          <button
            onClick={async () => {
              if (renameFor) await renameSource(renameFor.id, renameDraft);
              setRenameFor(null);
            }}
            className="btn-gold h-11 w-full text-sm"
          >
            Save
          </button>
        </div>
      </Sheet>

      {/* reference location */}
      <Sheet open={!!refFor} onClose={() => setRefFor(null)} title="Plus Code reference location">
        <div className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-ink-dim">
            Short Plus Codes (like <span className="font-mono text-gold-soft">9RW8+V2J</span>) are not globally unique —
            they need nearby context. Set a reference point close to your puja area, e.g. a city center, so rows with
            short codes can be resolved on the next refresh.
          </p>
          <input
            autoFocus
            value={refDraft}
            onChange={(e) => setRefDraft(e.target.value)}
            placeholder="23.7808, 90.4071"
            className="input font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!refFor) return;
                await setSourceRefs(refFor.id, null, null);
                setRefFor(null);
              }}
              className="btn-ghost h-11 flex-1 text-sm"
            >
              Clear
            </button>
            <button
              onClick={async () => {
                if (!refFor) return;
                const p = parseDecimalPair(refDraft.trim());
                if (!p) {
                  toast("Enter decimal coordinates like 23.7808, 90.4071", "err");
                  return;
                }
                await setSourceRefs(refFor.id, p.lat, p.lng);
                setRefFor(null);
                toast("Reference saved. Refresh the source to re-resolve rows.", "ok");
              }}
              className="btn-gold h-11 flex-1 text-sm"
            >
              Save reference
            </button>
          </div>
        </div>
      </Sheet>

      {/* delete */}
      <Sheet open={!!deleteFor} onClose={() => setDeleteFor(null)} title="Remove this source?">
        <p className="text-[12.5px] leading-relaxed text-ink-dim">
          This removes <span className="text-ink">{deleteFor?.name}</span> and its{" "}
          <span className="text-ink">{deleteFor?.validCount} locally cached mandaps</span> from this device. Saved
          routes and other sources are untouched. The Google Sheet itself is never modified.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setDeleteFor(null)} className="btn-ghost h-11 flex-1 text-sm">
            Cancel
          </button>
          <button
            onClick={async () => {
              if (deleteFor) await removeSource(deleteFor.id, true);
              setDeleteFor(null);
            }}
            className="btn-danger h-11 flex-1 text-sm"
          >
            Remove source
          </button>
        </div>
      </Sheet>

      {/* confirm destructive sync */}
      <Sheet open={!!confirmWipe} onClose={() => setConfirmWipe(null)} title="Sheet now looks empty">
        <p className="text-[12.5px] leading-relaxed text-ink-dim">
          The latest version of <span className="text-ink">{confirmWipe?.name}</span> contains no importable rows, but
          this device still holds {confirmWipe?.validCount} mandaps from the last good sync. Replacing them is
          destructive. If you only moved or renamed rows, cancel, fix the sheet, and refresh again.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setConfirmWipe(null)} className="btn-ghost h-11 flex-1 text-sm">
            Keep my data
          </button>
          <button onClick={confirmWipeNow} className="btn-danger h-11 flex-1 text-sm">
            Replace anyway
          </button>
        </div>
      </Sheet>

      {/* format guide */}
      <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} title="Sheet format guide" wide>
        <div className="space-y-3 text-[13px] leading-relaxed text-ink-dim">
          <div>
            <div className="label">1 · Share it</div>
            In Google Sheets: <span className="text-ink">Share → General access → “Anyone with the link”</span>{" "}
            (Viewer), or <span className="text-ink">File → Share → Publish to the web</span>. Then copy the
            address-bar URL — the tab you select (<span className="font-mono">#gid=…</span>) is imported.
          </div>
          <div>
            <div className="label">2 · Columns</div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-white/10 bg-black/30 text-gold-soft">
                    <th className="px-3 py-2">Column</th>
                    <th className="px-3 py-2">Required</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {[
                    ["name", "Yes", "Mandap name"],
                    ["location", "If no lat/lng", "Coordinates, Google Maps link, or Plus Code"],
                    ["latitude + longitude", "Alternative", "Decimal degrees, e.g. 23.7808 / 90.4071"],
                    ["address", "No", "Human-readable locality (helps short Plus Codes)"],
                    ["description", "No", "Any extra info"],
                    ["image_url", "No", "Public image link"],
                    ["facebook_url / instagram_url", "No", "Official pages"],
                    ["opening_hours", "No", "Visiting info"],
                    ["id", "No", "Stable row identity across refreshes"],
                  ].map((r) => (
                    <tr key={r[0]}>
                      <td className="px-3 py-1.5 font-mono text-gold-soft/90">{r[0]}</td>
                      <td className="px-3 py-1.5">{r[1]}</td>
                      <td className="px-3 py-1.5">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            Headers are matched case-insensitively with common aliases (e.g. <span className="font-mono">lat</span>,{" "}
            <span className="font-mono">google maps</span>, <span className="font-mono">timings</span>).
          </div>
          <div>
            <div className="label">3 · Location values</div>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Decimal pair: <span className="font-mono text-ink">22.3569, 91.7832</span>
              </li>
              <li>
                Maps link with coordinates: <span className="font-mono text-ink">https://www.google.com/maps?q=…</span>
              </li>
              <li>
                Full Plus Code: <span className="font-mono text-ink">7JCR9RW8+V2J</span>
              </li>
              <li>
                Short Plus Code: <span className="font-mono text-ink">9RW8+V2J</span> — needs the source's reference
                point or the row's lat/lng. Never treated as globally unique.
              </li>
            </ul>
            Shortened <span className="font-mono">goo.gl</span> links cannot be expanded client-side — open them once
            and paste the long URL.
          </div>
        </div>
      </Sheet>
    </div>
  );
}
