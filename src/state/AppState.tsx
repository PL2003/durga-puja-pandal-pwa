/**
 * Global application state: local-first data loading, offline/online awareness,
 * automatic sync triggers (start / foreground / reconnect / manual), selection
 * for route planning and saved-route persistence.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  countMandapsFor,
  deleteRoute,
  deleteSource,
  getPref,
  listAllMandaps,
  listRoutes,
  listSources,
  putRoute,
  putSource,
  setPref,
} from "@/lib/db";
import { commitParsed, syncSource, type SyncOutcome } from "@/lib/sync";
import { parseSheetUrl } from "@/lib/sheets";
import { buildDemoSource, demoParsedSheet } from "@/lib/demo";
import type { ImportIssue, LatLng, Mandap, SavedRoute, SourceMeta, TravelMode } from "@/types";
import { nanoid } from "nanoid";

export type Tab = "plan" | "explore" | "map" | "routes" | "sources";

export interface RouteOverlay {
  geometry: [number, number][] | null;
  orderIds: string[];
  start: LatLng | null;
  startLabel: string;
  quality: "road" | "approx";
  distanceM: number;
  durationS: number;
}

export interface Toast {
  id: string;
  text: string;
  kind: "ok" | "err" | "info";
}

interface AppStateValue {
  loading: boolean;
  online: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  sources: SourceMeta[];
  mandaps: Mandap[];
  routes: SavedRoute[];
  /** 'all' or a source id */
  filter: string;
  setFilter: (f: string) => void;
  visibleMandaps: Mandap[];
  resolvedMandaps: Mandap[];
  unresolvedMandaps: Mandap[];
  selection: string[];
  toggleSelect: (id: string) => void;
  moveSelection: (id: string, dir: -1 | 1) => void;
  clearSelection: () => void;
  setSelectionIds: (ids: string[]) => void;
  travelMode: TravelMode;
  setTravelMode: (m: TravelMode) => void;
  userPos: LatLng | null;
  geoStatus: "idle" | "busy" | "denied";
  locateMe: () => void;
  syncAllNow: () => void;
  syncOne: (id: string, opts?: { force?: boolean; allowEmpty?: boolean }) => Promise<SyncOutcome | null>;
  addGoogleSource: (args: { url: string; name: string; refLat: number | null; refLng: number | null }) => Promise<{ outcome: SyncOutcome | null; error?: string }>;
  addDemoSource: () => Promise<void>;
  removeSource: (id: string, deleteRecords: boolean) => Promise<void>;
  renameSource: (id: string, name: string) => Promise<void>;
  setSourceRefs: (id: string, refLat: number | null, refLng: number | null) => Promise<void>;
  saveRoute: (route: SavedRoute) => Promise<void>;
  removeRoute: (id: string) => Promise<void>;
  mapFocusId: string | null;
  focusOnMap: (mandapId: string | null) => void;
  issuesById: Record<string, ImportIssue[]>;
  loadIssues: (id: string) => Promise<ImportIssue[]>;
  overlay: RouteOverlay | null;
  setOverlay: (o: RouteOverlay | null) => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  installPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Ctx = createContext<AppStateValue | null>(null);

export function useApp(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [tab, setTab] = useState<Tab>("explore");
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [mandaps, setMandaps] = useState<Mandap[]>([]);
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [filter, setFilterState] = useState("all");
  const [selection, setSelection] = useState<string[]>([]);
  const [travelMode, setTravelModeState] = useState<TravelMode>("walking");
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "busy" | "denied">("idle");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mapFocusId, setMapFocusId] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [issuesById, setIssuesById] = useState<Record<string, ImportIssue[]>>({});
  const [overlay, setOverlay] = useState<RouteOverlay | null>(null);
  const lastAutoSync = useRef(0);
  const syncingRef = useRef(false);

  const recordIssues = useCallback((id: string, issues: ImportIssue[]) => {
    setIssuesById((prev) => ({ ...prev, [id]: issues }));
    setPref(`issues:${id}`, issues.slice(0, 300)).catch(() => undefined);
  }, []);

  const loadIssues = useCallback(
    async (id: string): Promise<ImportIssue[]> => {
      const cached = issuesById[id];
      if (cached) return cached;
      try {
        const stored = await getPref<ImportIssue[]>(`issues:${id}`, []);
        setIssuesById((prev) => ({ ...prev, [id]: stored }));
        return stored;
      } catch {
        return [];
      }
    },
    [issuesById]
  );

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = nanoid(6);
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [s, m, r] = await Promise.all([listSources(), listAllMandaps(), listRoutes()]);
      setSources(s);
      setMandaps(m);
      setRoutes(r);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to read local storage", "err");
    }
  }, [toast]);

  /* -------- boot -------- */
  useEffect(() => {
    (async () => {
      try {
        const [sel, f, tm] = await Promise.all([
          getPref<string[]>("selection", []),
          getPref<string>("filter", "all"),
          getPref<TravelMode>("travelMode", "walking"),
        ]);
        setSelection(sel);
        setFilterState(f);
        setTravelModeState(tm);
      } catch {
        /* first run */
      }
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  /* -------- auto sync triggers -------- */
  const maybeAutoSync = useCallback(
    async (reason: "start" | "foreground" | "online", force = false) => {
      if (syncingRef.current) return;
      if (!navigator.onLine) return;
      const sheetSources = sources.filter((s) => s.kind === "google-sheet");
      if (sheetSources.length === 0) return;
      const now = Date.now();
      const throttleMs = reason === "start" ? 0 : 90_000;
      if (!force && now - lastAutoSync.current < throttleMs) return;
      lastAutoSync.current = now;
      syncingRef.current = true;
      let changed = false;
      for (const src of sheetSources) {
        const outcome = await syncSource(src);
        setSources((prev) => prev.map((p) => (p.id === outcome.meta.id ? outcome.meta : p)));
        if (outcome.kind === "ok" || outcome.kind === "invalid") recordIssues(src.id, outcome.issues);
        if (outcome.kind === "needs-confirm") recordIssues(src.id, outcome.parsed.issues);
        if (outcome.kind === "ok") {
          changed = true;
          toast(
            `“${outcome.meta.name}” updated — ${outcome.added} new, ${outcome.updated} changed, ${outcome.removed} removed.`,
            "ok"
          );
        } else if (outcome.kind === "failed") {
          toast(`Sync failed for “${outcome.meta.name}”: ${outcome.error}`, "err");
        } else if (outcome.kind === "invalid") {
          toast(`“${outcome.meta.name}” has a structure problem. Open Sources to review.`, "err");
        } else if (outcome.kind === "needs-confirm") {
          toast(`“${outcome.meta.name}” now looks empty. Review in Sources before replacing.`, "info");
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      if (changed) await reload();
      syncingRef.current = false;
    },
    [sources, reload, toast]
  );

  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  useEffect(() => {
    if (!loading) maybeAutoSync("start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeAutoSync("foreground");
    };
    const onOnline = () => {
      setOnline(true);
      toast("Back online — refreshing your sheets.", "ok");
      maybeAutoSync("online");
    };
    const onOffline = () => {
      setOnline(false);
      toast("You are offline. Cached data stays available.", "info");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [maybeAutoSync, toast]);

  /* -------- install prompt -------- */
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) {
      toast("Open the browser menu and choose “Add to Home screen” to install.", "info");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") toast("Installed — Pandal Hop is on your home screen.", "ok");
    setInstallPrompt(null);
  }, [installPrompt, toast]);

  /* -------- selection & prefs -------- */
  const persistSelection = useCallback((next: string[]) => {
    setSelection(next);
    setPref("selection", next).catch(() => undefined);
  }, []);

  const toggleSelect = useCallback(
    (id: string) => {
      persistSelection(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);
    },
    [selection, persistSelection]
  );

  const moveSelection = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = selection.indexOf(id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= selection.length) return;
      const next = [...selection];
      [next[idx], next[target]] = [next[target], next[idx]];
      persistSelection(next);
    },
    [selection, persistSelection]
  );

  const clearSelection = useCallback(() => persistSelection([]), [persistSelection]);

  const setSelectionIds = useCallback((ids: string[]) => persistSelection(ids), [persistSelection]);

  const setFilter = useCallback((f: string) => {
    setFilterState(f);
    setPref("filter", f).catch(() => undefined);
  }, []);

  const setTravelMode = useCallback((m: TravelMode) => {
    setTravelModeState(m);
    setPref("travelMode", m).catch(() => undefined);
  }, []);

  /* -------- geolocation -------- */
  const locateMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast("This device does not support location.", "err");
      return;
    }
    setGeoStatus("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("idle");
      },
      () => {
        setGeoStatus("denied");
        toast("Location permission denied. You can still plan without it.", "err");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, [toast]);

  /* -------- sources -------- */
  const syncOne = useCallback(
    async (id: string, opts?: { force?: boolean; allowEmpty?: boolean }): Promise<SyncOutcome | null> => {
      const src = sourcesRef.current.find((s) => s.id === id);
      if (!src) return null;
      setSources((prev) => prev.map((p) => (p.id === id ? { ...p, status: "syncing", lastAttemptAt: Date.now() } : p)));
      const outcome = await syncSource(src, opts);
      setSources((prev) => prev.map((p) => (p.id === id ? outcome.meta : p)));
      if (outcome.kind === "ok" || outcome.kind === "invalid") recordIssues(id, outcome.issues);
      if (outcome.kind === "needs-confirm") recordIssues(id, outcome.parsed.issues);
      if (outcome.kind === "ok") await reload();
      return outcome;
    },
    [reload]
  );

  const addGoogleSource = useCallback(
    async (args: { url: string; name: string; refLat: number | null; refLng: number | null }) => {
      const ref = parseSheetUrl(args.url);
      if (!ref.ok) return { outcome: null, error: ref.message || "Invalid link." };
      const meta: SourceMeta = {
        id: `src-${nanoid(8)}`,
        name: args.name.trim() || "Untitled sheet",
        url: args.url.trim(),
        csvUrl: ref.csvUrl,
        sheetId: ref.sheetId,
        gid: ref.gid,
        kind: "google-sheet",
        refLat: args.refLat,
        refLng: args.refLng,
        status: "idle",
        lastAttemptAt: null,
        lastSyncAt: null,
        lastRevision: null,
        lastError: null,
        datasetVersion: 0,
        validCount: 0,
        issueCount: 0,
        createdAt: Date.now(),
      };
      await putSource(meta);
      setSources((prev) => [...prev, meta]);
      const outcome = await syncOne(meta.id, { force: true });
      return { outcome, error: undefined };
    },
    [syncOne]
  );

  const addDemoSource = useCallback(async () => {
    if (sourcesRef.current.some((s) => s.id === buildDemoSource().id)) {
      toast("The sample dataset is already added.", "info");
      return;
    }
    const meta = buildDemoSource();
    const parsed = demoParsedSheet(meta.id);
    const outcome = await commitParsed(meta, parsed);
    setSources((prev) => [...prev, outcome.meta]);
    await reload();
    toast("Sample dataset added locally. Explore it, then connect your own sheet.", "ok");
  }, [reload, toast]);

  const removeSource = useCallback(
    async (id: string, deleteRecords: boolean) => {
      await deleteSource(id, deleteRecords);
      if (!deleteRecords) {
        // keep records? spec-friendlier to always delete with the source; guard anyway
      }
      setSelection((sel) => {
        const kept = deleteRecords ? sel.filter((x) => !x.startsWith(`${id}:`)) : sel;
        setPref("selection", kept).catch(() => undefined);
        return kept;
      });
      if (filter === id) setFilter("all");
      await reload();
      toast("Source removed from this device.", "ok");
    },
    [filter, reload, setFilter, toast]
  );

  const renameSource = useCallback(
    async (id: string, name: string) => {
      const src = sourcesRef.current.find((s) => s.id === id);
      if (!src) return;
      const meta = { ...src, name: name.trim() || src.name };
      await putSource(meta);
      setSources((prev) => prev.map((p) => (p.id === id ? meta : p)));
    },
    []
  );

  const setSourceRefs = useCallback(async (id: string, refLat: number | null, refLng: number | null) => {
    const src = sourcesRef.current.find((s) => s.id === id);
    if (!src) return;
    const meta = { ...src, refLat, refLng };
    await putSource(meta);
    setSources((prev) => prev.map((p) => (p.id === id ? meta : p)));
  }, []);

  /* -------- routes -------- */
  const saveRoute = useCallback(
    async (route: SavedRoute) => {
      await putRoute(route);
      await reload();
      toast(`Route “${route.name}” saved on this device.`, "ok");
    },
    [reload, toast]
  );

  const removeRoute = useCallback(
    async (id: string) => {
      await deleteRoute(id);
      await reload();
      toast("Route deleted.", "info");
    },
    [reload, toast]
  );

  const focusOnMap = useCallback(
    (mandapId: string | null) => {
      setMapFocusId(mandapId);
      setTab("map");
    },
    []
  );

  const syncAllNow = useCallback(() => {
    maybeAutoSync("start", true);
  }, [maybeAutoSync]);

  /* -------- derived -------- */
  const visibleMandaps = useMemo(
    () => (filter === "all" ? mandaps : mandaps.filter((m) => m.sourceId === filter)),
    [mandaps, filter]
  );
  const resolvedMandaps = useMemo(() => visibleMandaps.filter((m) => m.lat !== null && m.lng !== null), [visibleMandaps]);
  const unresolvedMandaps = useMemo(() => visibleMandaps.filter((m) => m.lat === null || m.lng === null), [visibleMandaps]);

  const value: AppStateValue = {
    loading,
    online,
    tab,
    setTab,
    sources,
    mandaps,
    routes,
    filter,
    setFilter,
    visibleMandaps,
    resolvedMandaps,
    unresolvedMandaps,
    selection,
    toggleSelect,
    moveSelection,
    clearSelection,
    setSelectionIds,
    travelMode,
    setTravelMode,
    userPos,
    geoStatus,
    locateMe,
    syncAllNow,
    syncOne,
    addGoogleSource,
    addDemoSource,
    removeSource,
    renameSource,
    setSourceRefs,
    saveRoute,
    removeRoute,
    mapFocusId,
    focusOnMap,
    issuesById,
    loadIssues,
    overlay,
    setOverlay,
    toasts,
    toast,
    installPrompt,
    promptInstall,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { countMandapsFor };
