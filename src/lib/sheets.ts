/** Google Sheets URL validation + CSV retrieval. */

export interface SheetRef {
  ok: boolean;
  message?: string;
  sheetId: string;
  gid: string;
  csvUrl: string;
  kind: "standard" | "published" | "csv" | null;
}

const STANDARD_RE = /docs\.google\.com\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9-_]{20,})/;
const PUBLISHED_RE = /docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]{20,})/;

/**
 * Parse a user-supplied Google Sheets link. Accepts:
 *  - standard edit links:  https://docs.google.com/spreadsheets/d/<id>/edit#gid=0
 *  - published links:      https://docs.google.com/spreadsheets/d/e/<id>/pubhtml?gid=…
 *  - direct CSV exports:   …/export?format=csv  /  …/pub?output=csv
 */
export function parseSheetUrl(input: string): SheetRef {
  const blank: SheetRef = { ok: false, sheetId: "", gid: "0", csvUrl: "", kind: null };
  const raw = (input || "").trim();
  if (!raw) return { ...blank, message: "Paste a Google Sheets link first." };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ...blank, message: "That does not look like a valid URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ...blank, message: "Only http(s) links are supported." };
  }
  if (!/(^|\.)docs\.google\.com$/.test(url.hostname) && !/(^|\.)sheets\.google\.com$/.test(url.hostname)) {
    return { ...blank, message: "Please use a docs.google.com spreadsheet link." };
  }

  // gid may live in the hash (#gid=123) or the query (?gid=123)
  const gidMatch = url.hash.match(/gid=(\d+)/) || url.search.match(/gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  const pub = raw.match(PUBLISHED_RE);
  if (pub) {
    const sheetId = pub[1];
    return {
      ok: true,
      kind: "published",
      sheetId,
      gid,
      csvUrl: `https://docs.google.com/spreadsheets/d/e/${sheetId}/pub?gid=${gid}&single=true&output=csv`,
    };
  }

  const std = raw.match(STANDARD_RE);
  if (std) {
    const sheetId = std[1];
    return {
      ok: true,
      kind: "standard",
      sheetId,
      gid,
      csvUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    };
  }

  return {
    ...blank,
    message:
      "Could not find a spreadsheet ID in that link. Open the sheet in a browser and copy the full address-bar URL.",
  };
}

export class SheetFetchError extends Error {
  code: "network" | "http" | "private" | "not-csv" | "too-large" | "timeout" | "empty";
  constructor(code: SheetFetchError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB guard

/** Download a spreadsheet's CSV representation with timeout + size guards. */
export async function fetchCsv(csvUrl: string, timeoutMs = 22000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(csvUrl, { signal: ctrl.signal, cache: "no-store" });
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new SheetFetchError("timeout", "The request timed out. Check your connection and retry.");
    }
    throw new SheetFetchError(
      "network",
      "Could not reach Google Sheets. You may be offline, or the sheet's sharing settings block access."
    );
  }
  clearTimeout(timer);

  if (res.status === 401 || res.status === 403) {
    throw new SheetFetchError(
      "private",
      "This sheet is private. In Google Sheets choose Share → “Anyone with the link” (Viewer), or File → Publish to the web."
    );
  }
  if (res.status === 404) {
    throw new SheetFetchError("http", "Spreadsheet not found (404). Check that the link is complete.");
  }
  if (!res.ok) {
    throw new SheetFetchError("http", `Google Sheets returned an error (HTTP ${res.status}).`);
  }
  if ((Number(res.headers.get("content-length")) || 0) > MAX_BYTES) {
    throw new SheetFetchError("too-large", "The sheet is too large to import on this device (over 6 MB).");
  }

  const text = await res.text();
  if (text.length > MAX_BYTES) {
    throw new SheetFetchError("too-large", "The sheet is too large to import on this device (over 6 MB).");
  }
  const trimmed = text.replace(/^﻿/, "").trim();
  if (!trimmed) {
    throw new SheetFetchError("empty", "The sheet tab appears to be empty.");
  }
  // Google returns an HTML sign-in page for private sheets in many configurations.
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    throw new SheetFetchError(
      "private",
      "Google returned a sign-in page instead of CSV. The sheet is probably not shared publicly (Share → “Anyone with the link”)."
    );
  }
  return trimmed;
}

/** Tiny non-cryptographic revision hash for change detection. */
export function revisionOf(text: string): string {
  let h = 5381;
  const step = Math.max(1, Math.floor(text.length / 4096));
  for (let i = 0; i < text.length; i += step) {
    h = (h * 33) ^ text.charCodeAt(i);
  }
  return `${(h >>> 0).toString(36)}-${text.length.toString(36)}`;
}
