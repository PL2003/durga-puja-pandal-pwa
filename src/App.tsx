/**
 * App shell: header (brand, sync/install actions), screen router, tab bar.
 */
import {
  Download,
  LayoutGrid,
  Map as MapIcon,
  RefreshCw,
  Route as RouteIcon,
  Sheet as SheetIcon,
  Wifi,
  WifiOff,
  Bookmark,
} from "lucide-react";
import { OfflineBanner, ToastStack } from "@/components/ui";
import ExploreScreen from "@/screens/ExploreScreen";
import MapScreen from "@/screens/MapScreen";
import PlanScreen from "@/screens/PlanScreen";
import RoutesScreen from "@/screens/RoutesScreen";
import SourcesScreen from "@/screens/SourcesScreen";
import { AppProvider, useApp, type Tab } from "@/state/AppState";
import { cn } from "@/utils/cn";

const NAV: { tab: Tab; label: string; icon: typeof MapIcon }[] = [
  { tab: "plan", label: "Plan", icon: RouteIcon },
  { tab: "explore", label: "Explore", icon: LayoutGrid },
  { tab: "map", label: "Map", icon: MapIcon },
  { tab: "routes", label: "Routes", icon: Bookmark },
  { tab: "sources", label: "Sources", icon: SheetIcon },
];

function Header() {
  const { online, sources, syncAllNow, installPrompt, promptInstall, selection } = useApp();
  const syncing = sources.some((s) => s.status === "syncing");
  return (
    <header className="relative z-40 flex items-center justify-between gap-2 border-b border-white/[0.06] bg-[#16090d]/88 px-4 py-3 pt-safe backdrop-blur">
      <div className="flex items-center gap-2.5">
        <img src="/icons/icon-192.png" alt="Pandal Hop" className="h-9 w-9 rounded-xl shadow-lg" />
        <div className="leading-tight">
          <div className="display text-[17px] font-bold tracking-wide text-ink">
            Pandal <span className="text-gold">Hop</span>
          </div>
          <div className="bangla text-[10.5px] text-ink-faint">দূর্গাপূজা পরিক্রমা</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={syncAllNow}
          aria-label="Sync all sheets now"
          title={online ? "Refresh all sheets" : "Offline"}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl border transition-colors",
            online ? "border-white/10 text-ink-dim hover:text-gold" : "border-gold/30 text-gold"
          )}
        >
          {syncing ? (
            <RefreshCw size={15} className="animate-spin text-gold" />
          ) : online ? (
            <Wifi size={15} />
          ) : (
            <WifiOff size={15} />
          )}
        </button>
        {installPrompt && (
          <button
            onClick={promptInstall}
            className="btn-gold h-9 gap-1.5 px-3 !text-[11.5px] font-semibold"
            aria-label="Install app"
          >
            <Download size={13} /> Install
          </button>
        )}
        <span className="chip !py-1 !pl-2 !pr-2.5 !text-[10.5px]" title="Selected stops">
          <RouteIcon size={11} className="text-gold" />
          {selection.length}
        </span>
      </div>
    </header>
  );
}

function Screens() {
  const { tab } = useApp();
  switch (tab) {
    case "plan":
      return <PlanScreen />;
    case "explore":
      return <ExploreScreen />;
    case "map":
      return <MapScreen />;
    case "routes":
      return <RoutesScreen />;
    case "sources":
      return <SourcesScreen />;
  }
}

function TabBar() {
  const { tab, setTab, selection, routes } = useApp();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 pb-safe">
      <div className="mx-auto flex max-w-lg items-stretch gap-1 border-t border-white/[0.07] bg-[#16090d]/92 px-2 pb-1 pt-1.5 backdrop-blur-lg">
        {NAV.map(({ tab: t, label, icon: Icon }) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors",
                active ? "text-gold" : "text-ink-faint hover:text-ink-dim"
              )}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
              <span className={cn("text-[10px] font-medium", active && "font-semibold")}>{label}</span>
              {active && <span className="absolute -top-[7px] h-[2.5px] w-8 rounded-full bg-gold shadow-gold" />}
              {t === "plan" && selection.length > 0 && (
                <span className="absolute right-[16%] top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-bold text-[#2a1503]">
                  {selection.length}
                </span>
              )}
              {t === "routes" && routes.length > 0 && (
                <span className="absolute right-[16%] top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-maroon px-1 text-[9px] font-bold text-ink">
                  {routes.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Shell() {
  const { loading } = useApp();
  if (loading) {
    return (
      <div className="grid h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/icons/icon-192.png" alt="" className="h-16 w-16 animate-pulse-soft rounded-2xl" />
          <div className="display text-sm tracking-[0.28em] text-gold-soft/80 uppercase">Lighting the dhunuchi…</div>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col">
      <Header />
      <OfflineBanner />
      <main className="relative min-h-0 flex-1 animate-fade">
        <Screens />
      </main>
      <div className="h-[76px] shrink-0" />
      <TabBar />
      <ShadowDecor />
    </div>
  );
}

/** Soft alpana-inspired ambient flourishes. */
function ShadowDecor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-maroon/25 blur-3xl" />
      <div className="absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-gold/[0.06] blur-3xl" />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
      <ToastStack />
    </AppProvider>
  );
}
