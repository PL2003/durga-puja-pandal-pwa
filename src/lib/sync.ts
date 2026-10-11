/**
 * Offline-first synchronization engine.
 *
 * Guarantees:
 *  - failed fetches/validations never erase the last good dataset
 *  - an unexpectedly empty or invalid sheet requires explicit user confirmation
 *    before wiping that source's records
 *  - records from other sources and saved routes are never touched
 *  - unchanged revisions skip record replacement entirely
 */
import { replaceSourceMandaps, putSource, countMandapsFor } from "@/lib/db";
import { parseSheet } from "@/lib/importer";
import { fetchCsv, revisionOf, SheetFetchError } from "@/lib/sheets";
import type { ImportIssue, ParsedSheet, SourceMeta } from "@/types";

export type SyncOutcome =
  | { kind: "unchanged"; meta: SourceMeta }
  | { kind: "ok"; meta: SourceMeta; added: number; updated: number; removed: number; issues: ImportIssue[] }
  | { kind: "needs-confirm"; meta: SourceMeta; parsed: ParsedSheet; existing: number }
  | { kind: "failed"; meta: SourceMeta; error: string }
  | { kind: "invalid"; meta: SourceMeta; error: string; issues: ImportIssue[] };

/** Fetch → validate → (maybe) commit one source. */
export async function syncSource(source: SourceMeta, opts: { force?: boolean; allowEmpty?: boolean } = {}): Promise<SyncOutcome> {
  const attempted: SourceMeta = { ...source, lastAttemptAt: Date.now(), status: "syncing" };

  let csv: string;
  try {
    csv = await fetchCsv(source.csvUrl);
  } catch (err) {
    const msg = err instanceof SheetFetchError ? err.message : "Unexpected error while downloading the sheet.";
    const meta: SourceMeta = { ...attempted, status: "sync-failed", lastError: msg };
    await putSource(meta).catch(() => undefined);
    return { kind: "failed", meta, error: msg };
  }

  const revision = revisionOf(csv);
  const existing = await countMandapsFor(source.id);
  if (!opts.force && revision === source.lastRevision && existing > 0) {
    const meta: SourceMeta = { ...attempted, status: "ok", lastError: null };
    await putSource(meta).catch(() => undefined);
    return { kind: "unchanged", meta };
  }

  const parsed = parseSheet(csv, { sourceId: source.id, refLat: source.refLat, refLng: source.refLng });

  // Structural failure: keep the previous dataset untouched.
  const structural = parsed.issues.filter((i) => i.code === "missing-columns" || i.code === "empty");
  if (parsed.mandaps.length === 0 && structural.length > 0) {
    const meta: SourceMeta = {
      ...attempted,
      status: "invalid",
      lastError: structural[0].message,
      issueCount: parsed.issues.length,
    };
    await putSource(meta).catch(() => undefined);
    return { kind: "invalid", meta, error: structural[0].message, issues: parsed.issues };
  }

  // Destructive guard: new import would wipe everything — ask for confirmation.
  if (parsed.mandaps.length === 0 && existing > 0 && !opts.allowEmpty) {
    const meta: SourceMeta = { ...attempted, status: "confirm-empty", lastError: null };
    await putSource(meta).catch(() => undefined);
    return { kind: "needs-confirm", meta, parsed, existing };
  }

  return commitParsed({ ...attempted, lastRevision: revision }, parsed);
}

/** Transactionally commit an already-parsed dataset for a source. */
export async function commitParsed(metaBase: SourceMeta, parsed: ParsedSheet): Promise<SyncOutcome> {
  try {
    const meta: SourceMeta = {
      ...metaBase,
      status: "ok",
      lastSyncAt: Date.now(),
      lastError: parsed.issues.length ? `${parsed.issues.length} row${parsed.issues.length === 1 ? "" : "s"} need attention` : null,
      datasetVersion: (metaBase.datasetVersion || 0) + 1,
      validCount: parsed.mandaps.length,
      issueCount: parsed.issues.length,
    };
    const stats = await replaceSourceMandaps(metaBase.id, parsed.mandaps, meta);
    return { kind: "ok", meta, ...stats, issues: parsed.issues };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to write to local storage.";
    const meta: SourceMeta = { ...metaBase, status: "sync-failed", lastError: msg };
    await putSource(meta).catch(() => undefined);
    return { kind: "failed", meta, error: msg };
  }
}

/** Sequentially sync all sources (used for app-start / foreground / reconnect sync). */
export async function syncAll(
  sources: SourceMeta[],
  onProgress?: (sourceId: string, outcome: SyncOutcome) => void,
  opts: { force?: boolean } = {}
): Promise<void> {
  for (const source of sources) {
    if (source.kind !== "google-sheet") continue;
    const outcome = await syncSource(source, opts);
    onProgress?.(source.id, outcome);
    // yield to keep the UI thread responsive between sources
    await new Promise((r) => setTimeout(r, 30));
  }
}
