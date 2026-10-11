/** Shared data model for the Pandal Hop application. */

export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = "walking" | "driving" | "cycling";

export type SyncStatus =
  | "idle" // never synced
  | "syncing"
  | "ok" // up to date
  | "sync-failed"
  | "invalid" // spreadsheet structurally invalid
  | "confirm-empty"; // new import would wipe existing data

/** A user-configured Google Sheet (or the bundled local demo dataset). */
export interface SourceMeta {
  id: string;
  name: string;
  url: string; // original URL the user pasted
  csvUrl: string; // derived CSV export endpoint
  sheetId: string;
  gid: string;
  kind: "google-sheet" | "demo";
  /** Optional reference coordinate used to resolve short Plus Codes. */
  refLat: number | null;
  refLng: number | null;
  status: SyncStatus;
  lastAttemptAt: number | null;
  lastSyncAt: number | null;
  /** Hash of the last successfully imported CSV payload ("revision indicator"). */
  lastRevision: string | null;
  lastError: string | null;
  datasetVersion: number;
  validCount: number;
  issueCount: number;
  createdAt: number;
}

export type LocationKind =
  | "columns" // latitude / longitude columns
  | "coords" // decimal pair inside the location field
  | "gmaps" // coordinates extracted from a Google Maps URL
  | "plus-full" // full Open Location Code
  | "plus-short" // short Plus Code resolved against a reference
  | "none"; // unresolved

export interface Mandap {
  /** Stable local identity: `${sourceId}:${recordKey}` */
  id: string;
  sourceId: string;
  /** Stable identity within the source sheet (`id` column, else `row-N`). */
  recordKey: string;
  row: number; // spreadsheet row number (1-indexed, header = row 1)
  name: string;
  /** Lowercased name used for IndexedDB name index + search. */
  nameKey: string;
  locationRaw: string;
  lat: number | null;
  lng: number | null;
  locationKind: LocationKind;
  address: string;
  description: string;
  imageUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  openingHours: string;
  updatedAt: number;
}

export interface ImportIssue {
  row: number;
  name: string;
  field: string;
  code:
    | "missing-name"
    | "missing-location"
    | "invalid-coords"
    | "invalid-url"
    | "invalid-pluscode"
    | "shortcode-no-reference"
    | "conflict"
    | "duplicate"
    | "missing-columns"
    | "empty";
  message: string;
}

export interface ColumnMap {
  name: number | null;
  location: number | null;
  latitude: number | null;
  longitude: number | null;
  address: number | null;
  description: number | null;
  imageUrl: number | null;
  facebookUrl: number | null;
  instagramUrl: number | null;
  openingHours: number | null;
  id: number | null;
}

export interface ParsedSheet {
  headers: string[];
  map: ColumnMap;
  totalRows: number;
  mandaps: Mandap[];
  issues: ImportIssue[];
  suggestedName: string;
}

export type RouteQuality = "road" | "approx";

export interface SavedRoute {
  id: string;
  name: string;
  mandapIds: string[];
  order: string[]; // mandap ids in visiting order
  startLabel: string;
  start: LatLng | null;
  travelMode: TravelMode;
  distanceM: number;
  durationS: number;
  quality: RouteQuality;
  geometry: [number, number][] | null;
  createdAt: number;
  updatedAt: number;
}

export interface RouteResult {
  orderIds: string[];
  distanceM: number;
  durationS: number;
  quality: RouteQuality;
  geometry: [number, number][] | null;
  /** per-leg durations in seconds (aligned with orderIds) */
  legDurations: number[];
}

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  walking: "Walking",
  driving: "Driving",
  cycling: "Cycling",
};
