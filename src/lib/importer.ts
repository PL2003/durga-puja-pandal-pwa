/** Spreadsheet → normalized Mandap records, with actionable per-row diagnostics. */
import Papa from "papaparse";
import { resolveLocation } from "@/lib/location";
import type { ColumnMap, ImportIssue, Mandap, ParsedSheet } from "@/types";

type ColumnKey = keyof ColumnMap;

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  name: ["name", "mandap", "mandap name", "pandal", "puja", "puja mandap", "title", "venue"],
  location: [
    "location",
    "coordinates",
    "coordinate",
    "coords",
    "gps",
    "map",
    "map link",
    "google maps",
    "gmap",
    "gmap link",
    "location link",
    "plus code",
    "pluscode",
    "google maps link",
    "maps link",
  ],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon", "long"],
  address: ["address", "locality", "area", "place", "para", "neighborhood", "neighbourhood", "location name"],
  description: ["description", "details", "notes", "note", "info", "about"],
  imageUrl: ["image", "image_url", "image url", "image link", "photo", "photo_url", "photo link", "img"],
  facebookUrl: ["facebook", "facebook_url", "fb", "facebook link", "fb link", "fb_url"],
  instagramUrl: ["instagram", "instagram_url", "ig", "instagram link"],
  openingHours: ["opening_hours", "opening hours", "hours", "timing", "timings", "visiting hours", "open", "visiting time"],
  id: ["id", "uid", "key", "record id", "sl", "sl no", "serial", "serial no", "no", "#"],
};

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[﻿]/g, "").replace(/\s+/g, " ").trim();
}

/** Map raw spreadsheet headers to canonical columns (case-insensitive, whitespace tolerant). */
export function buildColumnMap(headers: string[]): { map: ColumnMap; matched: Record<string, string> } {
  const map: ColumnMap = {
    name: null,
    location: null,
    latitude: null,
    longitude: null,
    address: null,
    description: null,
    imageUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    openingHours: null,
    id: null,
  };
  const matched: Record<string, string> = {};
  const keys = Object.keys(HEADER_ALIASES) as ColumnKey[];
  const norms = headers.map(normHeader);

  for (const key of keys) {
    // 1) exact alias match
    let idx = norms.findIndex((h) => h !== "" && HEADER_ALIASES[key].includes(h));
    // 2) fallback: header begins with alias (e.g. "mandap name (english)")
    if (idx === -1) {
      idx = norms.findIndex((h) => h !== "" && HEADER_ALIASES[key].some((a) => h.startsWith(a)));
    }
    if (idx !== -1) {
      map[key] = idx;
      matched[key] = headers[idx];
    }
  }
  return { map, matched };
}

export function missingRequiredColumns(map: ColumnMap): string[] {
  const missing: string[] = [];
  if (map.name === null) missing.push("name");
  if (map.location === null && (map.latitude === null || map.longitude === null)) {
    missing.push("location (or latitude + longitude)");
  }
  return missing;
}

interface ParseOptions {
  sourceId: string;
  refLat: number | null;
  refLng: number | null;
  maxRows?: number;
}

const MAX_ROWS_HARD = 5000;

export function parseSheet(csvText: string, opts: ParseOptions): ParsedSheet {
  const issues: ImportIssue[] = [];
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: "greedy",
  });
  const rawRows = result.data.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  if (rawRows.length === 0) {
    return {
      headers: [],
      map: buildColumnMap([]).map,
      totalRows: 0,
      mandaps: [],
      issues: [{ row: 0, name: "", field: "", code: "empty", message: "The sheet has no rows." }],
      suggestedName: "",
    };
  }

  const headers = rawRows[0].map((h) => String(h ?? "").trim());
  const { map } = buildColumnMap(headers);
  const missing = missingRequiredColumns(map);
  const totalRows = Math.max(0, rawRows.length - 1);

  if (missing.length > 0) {
    issues.push({
      row: 1,
      name: "",
      field: missing.join(", "),
      code: "missing-columns",
      message: `Required columns missing: ${missing.join(", ")}. Found headers: ${headers.filter(Boolean).join(", ") || "none"}.`,
    });
    return { headers, map, totalRows, mandaps: [], issues, suggestedName: headers[0] || "" };
  }

  const cap = opts.maxRows ?? MAX_ROWS_HARD;
  const dataRows = rawRows.slice(1, cap + 1);
  if (totalRows > cap) {
    issues.push({
      row: cap + 2,
      name: "",
      field: "",
      code: "empty",
      message: `Import capped at ${cap} rows for performance (${totalRows} rows found). Split the sheet into multiple tabs or sources.`,
    });
  }

  const cell = (row: string[], idx: number | null): string =>
    idx === null ? "" : String(row[idx] ?? "").trim();

  const mandaps: Mandap[] = [];
  const seenKeys = new Set<string>();
  const seenNameGeo = new Map<string, number>();
  const now = Date.now();

  dataRows.forEach((row, i) => {
    const sheetRow = i + 2; // header = row 1
    const name = cell(row, map.name);
    const push = (issue: Omit<ImportIssue, "row" | "name">) =>
      issues.push({ row: sheetRow, name: name || "(unnamed)", ...issue });

    if (!name) {
      push({
        field: "name",
        code: "missing-name",
        message: "Row has no mandap name. Add a name or delete the row.",
      });
      return;
    }

    const outcome = resolveLocation({
      location: cell(row, map.location),
      latitude: cell(row, map.latitude),
      longitude: cell(row, map.longitude),
      refLat: opts.refLat,
      refLng: opts.refLng,
    });

    let lat: number | null = null;
    let lng: number | null = null;
    let locationKind: Mandap["locationKind"] = "none";
    if (outcome.ok) {
      lat = outcome.lat;
      lng = outcome.lng;
      locationKind = outcome.kind;
      if (outcome.conflict) {
        push({
          field: "location",
          code: "conflict",
          message:
            "latitude/longitude columns and the location column disagree. The coordinate columns were used — please reconcile the sheet.",
        });
      }
    } else {
      push({ field: "location", code: outcome.code, message: outcome.message });
    }

    const rawId = cell(row, map.id);
    let recordKey = rawId ? `id-${rawId}` : `row-${sheetRow}`;
    if (seenKeys.has(recordKey)) {
      recordKey = `${recordKey}-${sheetRow}`;
      push({
        field: "id",
        code: "duplicate",
        message: `Duplicate id “${rawId}”. A row-based identity was assigned instead.`,
      });
    }
    seenKeys.add(recordKey);

    // soft duplicate detection: same normalized name + nearly identical coordinates
    if (lat !== null && lng !== null) {
      const geoKey = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
      if (seenNameGeo.has(geoKey)) {
        push({
          field: "name",
          code: "duplicate",
          message: `Possible duplicate of row ${seenNameGeo.get(geoKey)} (same name and coordinates).`,
        });
      } else {
        seenNameGeo.set(geoKey, sheetRow);
      }
    }

    mandaps.push({
      id: `${opts.sourceId}:${recordKey}`,
      sourceId: opts.sourceId,
      recordKey,
      row: sheetRow,
      name,
      nameKey: name.toLowerCase(),
      locationRaw: cell(row, map.location),
      lat,
      lng,
      locationKind,
      address: cell(row, map.address),
      description: cell(row, map.description),
      imageUrl: cell(row, map.imageUrl),
      facebookUrl: cell(row, map.facebookUrl),
      instagramUrl: cell(row, map.instagramUrl),
      openingHours: cell(row, map.openingHours),
      updatedAt: now,
    });
  });

  return { headers, map, totalRows, mandaps, issues, suggestedName: headers[0] || "" };
}
