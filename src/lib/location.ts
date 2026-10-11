/**
 * Location parsing & normalization.
 *
 * Supported representations for the `location` column:
 *  A. Decimal coordinates            "22.3569, 91.7832"
 *  B. Google Maps URLs               maps?q=…, /@lat,lng,…, !3dlat!4dlng
 *  C. Full Plus Codes (OLC)          "7JCR9RW8+V2J"
 *  D. Short Plus Codes               "9RW8+V2J" — only with an explicit reference
 *
 * Plus separate `latitude` / `longitude` columns, which take priority when valid.
 */
import { OpenLocationCode } from "open-location-code";
import { haversineMeters } from "@/lib/geo";
import type { ImportIssue, LocationKind } from "@/types";

export interface ResolveInput {
  location: string;
  latitude: string;
  longitude: string;
  /** Reference coordinate used to recover short Plus Codes. */
  refLat: number | null;
  refLng: number | null;
}

export type ResolveOutcome =
  | { ok: true; lat: number; lng: number; kind: LocationKind; conflict: boolean }
  | { ok: false; code: ImportIssue["code"]; message: string };

export function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function validLatLng(lat: number, lng: number): boolean {
  return isFiniteNum(lat) && isFiniteNum(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Parse "22.3569, 91.7832" (comma / space / semicolon separated). */
export function parseDecimalPair(text: string): { lat: number; lng: number } | null {
  const m = text
    .trim()
    .match(/^([+-]?\d{1,3}(?:\.\d+)?)\s*[,;]\s*([+-]?\d{1,3}(?:\.\d+)?)$|^[+]?\s*([+-]?\d{1,3}(?:\.\d+)?)\s+([+-]?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const a = Number(m[1] ?? m[3]);
  const b = Number(m[2] ?? m[4]);
  // Canonical order is "lat, lng". Swap when values clearly indicate lng-first input.
  if (validLatLng(a, b)) return { lat: a, lng: b };
  if (validLatLng(b, a) && Math.abs(a) > 90) return { lat: b, lng: a };
  return null;
}

/** Extract coordinates from a Google Maps link. Returns null when none are embedded. */
export function extractFromGoogleMapsUrl(url: URL): { lat: number; lng: number } | null {
  const raw = url.toString();

  // 1) "!3dLAT!4dLNG" — embedded place coordinates (most precise)
  const bang = raw.match(/!3d([+-]?\d{1,3}(?:\.\d+)?)!4d([+-]?\d{1,3}(?:\.\d+)?)/);
  if (bang) {
    const lat = Number(bang[1]);
    const lng = Number(bang[2]);
    if (validLatLng(lat, lng)) return { lat, lng };
  }

  // 2) "?q=lat,lng" / "query=" / "center=" / "ll="
  const qParams = ["q", "query", "center", "ll"];
  for (const key of qParams) {
    const v = url.searchParams.get(key);
    if (v) {
      const pair = parseDecimalPair(v);
      if (pair) return pair;
    }
  }

  // 3) "/@lat,lng,zoom" viewport (least precise — treated as approximate)
  const at = raw.match(/@([+-]?\d{1,3}(?:\.\d+)?),([+-]?\d{1,3}(?:\.\d+)?)(?:,|\/|$)/);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (validLatLng(lat, lng)) return { lat, lng };
  }
  return null;
}

export function isGoogleMapsHost(url: URL): boolean {
  return /(^|\.)google\.[a-z.]{2,}$/i.test(url.hostname) && url.pathname.startsWith("/maps");
}

/** Find a Plus Code token inside arbitrary text. */
export function extractPlusCode(text: string): string | null {
  const m = text.toUpperCase().match(/[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/);
  return m ? m[0] : null;
}

const CONFLICT_THRESHOLD_M = 60;

/**
 * Resolve one record's location using the documented priority:
 *  1. valid latitude/longitude columns
 *  2. decimal pair in `location`
 *  3. coordinates inside a Google Maps URL
 *  4. full Plus Code
 *  5. short Plus Code + explicit reference
 */
export function resolveLocation(input: ResolveInput): ResolveOutcome {
  const locationText = (input.location || "").trim();
  const latCol = (input.latitude || "").trim();
  const lngCol = (input.longitude || "").trim();

  let column: { lat: number; lng: number } | null = null;
  let columnError: string | null = null;
  if (latCol || lngCol) {
    const lat = Number(latCol);
    const lng = Number(lngCol);
    if (latCol !== "" && lngCol !== "" && validLatLng(lat, lng)) {
      column = { lat, lng };
    } else {
      columnError = `latitude/longitude columns are not a valid pair ("${latCol}", "${lngCol}")`;
    }
  }

  // Parse the location field (if any) so we can detect conflicts.
  let field: { lat: number; lng: number; kind: LocationKind } | null = null;
  let fieldError: { code: ImportIssue["code"]; message: string } | null = null;

  if (locationText) {
    const pair = parseDecimalPair(locationText);
    if (pair) {
      field = { ...pair, kind: "coords" };
    } else if (/^(https?:\/\/|www\.)/i.test(locationText)) {
      let url: URL | null = null;
      try {
        url = new URL(locationText.startsWith("www.") ? `https://${locationText}` : locationText);
      } catch {
        url = null;
      }
      if (!url) {
        fieldError = { code: "invalid-url", message: `Could not parse URL "${locationText}".` };
      } else if (url.hostname.includes("goo.gl") || url.hostname === "maps.app.goo.gl") {
        fieldError = {
          code: "invalid-url",
          message:
            "Shortened goo.gl links cannot be resolved offline. Open the link once in a browser, then copy the full google.com/maps URL into the sheet.",
        };
      } else if (isGoogleMapsHost(url)) {
        const found = extractFromGoogleMapsUrl(url);
        if (found) {
          field = { ...found, kind: "gmaps" };
        } else {
          fieldError = {
            code: "invalid-url",
            message:
              "This Google Maps link contains no extractable coordinates. Drop a pin in Google Maps, tap Share, and copy that link — or paste plain coordinates.",
          };
        }
      } else {
        fieldError = {
          code: "invalid-url",
          message: `Only Google Maps links are supported in the location column (got “${url.hostname}”).`,
        };
      }
    } else {
      const token = extractPlusCode(locationText);
      if (token && OpenLocationCode.isValid(token)) {
        try {
          if (OpenLocationCode.isShort(token)) {
            if (input.refLat == null || input.refLng == null || !validLatLng(input.refLat, input.refLng)) {
              fieldError = {
                code: "shortcode-no-reference",
                message: `“${token}” is a short Plus Code and is not globally unique. Add latitude/longitude columns to this row, or set a reference location on the data source.`,
              };
            } else {
              const full = OpenLocationCode.recoverNearest(token, input.refLat, input.refLng);
              const area = OpenLocationCode.decode(full);
              if (validLatLng(area.latitudeCenter, area.longitudeCenter)) {
                field = { lat: area.latitudeCenter, lng: area.longitudeCenter, kind: "plus-short" };
              } else {
                fieldError = { code: "invalid-pluscode", message: `Decoded Plus Code “${token}” is out of range.` };
              }
            }
          } else {
            const area = OpenLocationCode.decode(token);
            if (validLatLng(area.latitudeCenter, area.longitudeCenter)) {
              field = { lat: area.latitudeCenter, lng: area.longitudeCenter, kind: "plus-full" };
            } else {
              fieldError = { code: "invalid-pluscode", message: `Decoded Plus Code “${token}” is out of range.` };
            }
          }
        } catch {
          fieldError = { code: "invalid-pluscode", message: `Failed to decode Plus Code “${token}”.` };
        }
      } else if (token) {
        fieldError = {
          code: "invalid-pluscode",
          message: `“${token}” looks like a Plus Code but is malformed. Expected format like 9RW8+V2J.`,
        };
      } else {
        fieldError = {
          code: "invalid-url",
          message: `Could not interpret “${locationText}” as coordinates, a Google Maps link, or a Plus Code.`,
        };
      }
    }
  }

  // Decision matrix
  if (column && field) {
    const d = haversineMeters(column, field);
    const conflict = d > CONFLICT_THRESHOLD_M;
    return { ok: true, lat: column.lat, lng: column.lng, kind: "columns", conflict };
  }
  if (column) return { ok: true, lat: column.lat, lng: column.lng, kind: "columns", conflict: false };
  if (field) return { ok: true, lat: field.lat, lng: field.lng, kind: field.kind, conflict: false };

  if (columnError && !locationText) {
    return { ok: false, code: "invalid-coords", message: columnError };
  }
  if (fieldError) return { ok: false, code: fieldError.code, message: fieldError.message };
  if (columnError) return { ok: false, code: "invalid-coords", message: columnError };
  return {
    ok: false,
    code: "missing-location",
    message: "No location supplied. Add a location value (coordinates, Google Maps link, or Plus Code), or latitude + longitude columns.",
  };
}
