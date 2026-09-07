"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ListTree, Menu as MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sidebar } from "@/components/Sidebar";
import { SidebarSections, SECTIONS } from "@/components/SidebarSections";
import { Header } from "@/components/Header";
import { LoginDialog } from "@/components/LoginDialog";
import { MapInfoPanel } from "@/components/MapInfoPanel";
import { LayerSearch } from "@/components/LayerSearch";
import {
  Walkthrough,
  shouldAutoRunWalkthrough,
  markWalkthroughSeen,
} from "@/components/Walkthrough";
import { getToken, type Role } from "@/lib/auth";
import { useAuthState } from "@/hooks/use-auth-state";
import { fetchLayers, UnauthorizedError, type LayerCollection } from "@/lib/layers-api";
import { registryForRole, registryEntry, type LayerRegistryEntry } from "@/lib/gis-registry";
import type { StatsRasterLayer } from "@/components/StatsPanel";
import type { ActiveRasterLayer } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const EMPTY: LayerCollection = { type: "FeatureCollection", features: [] };

type MobileSheet = "menu" | "legend" | null;

// Sections whose geometry draws with a looping dash animation travelling
// along each line — flow on the linear features, marching ants on the
// boundaries.
//
// Both are networks rather than thematic surfaces, which is what makes the
// motion worth having: it traces where a road or a stream actually runs, and
// tells this connective geometry apart from the theme/LiDAR rasters at a
// glance. Streams in particular read as direction of flow. The sections are
// an accordion, so at most one of these is ever animating at a time.
const ANIMATED_SECTIONS = ["Base Layers", "Watershed Analysis"];

// Resolved once at module scope: SECTIONS and the registry are both static.
// Pending rows have no geometry to animate, so they drop out here.
const ANIMATED_LAYER_IDS: number[] = SECTIONS.filter((section) =>
  ANIMATED_SECTIONS.includes(section.label),
)
  .flatMap((section) => section.items ?? [])
  .map((item) => (item.layerId ? registryEntry(item.layerId) : undefined))
  .filter((entry) => entry?.status === "available")
  .map((entry) => entry!.numericId);

export function MapDashboard() {
  const auth = useAuthState();
  const [layers, setLayers] = useState<LayerCollection | null>(null);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [tourOpen, setTourOpen] = useState(false);

  // Accordion, mirroring apps/web: at most one section is on at a time, and
  // only that section's switched-on layers draw. Each section keeps its own
  // item state so reopening it restores what was on, rather than resurrecting
  // switches that look checked while their section is off.
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, Record<number, boolean>>>({});
  const [rasterYear, setRasterYear] = useState<Record<string, number>>({});
  const [lockedPromptSection, setLockedPromptSection] = useState<string | null>(null);

  const token = getToken();
  // Unsigned demo token, decoded client-side only — same trust model as
  // lib/layers-api.ts's own roleFromToken().
  const role = (auth.user?.role as Role | undefined) ?? null;
  const registryLayers = registryForRole(role);

  // Refetch whenever the token or retry count changes — with no token the
  // API resolves the request to its public role rather than rejecting it,
  // so this runs for anonymous visitors too. The returned cleanup clears
  // the previous role's data before the new fetch lands, rather than
  // setting state synchronously in the effect body itself.
  useEffect(() => {
    let cancelled = false;
    fetchLayers(token)
      .then((fc) => {
        if (!cancelled) setLayers(fc);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) auth.logout();
        setError(true);
      });
    return () => {
      cancelled = true;
      setLayers(null);
      setError(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, retryTick]);

  // First visit runs the walkthrough on its own. The delay lets the lazily
  // loaded map and the sidebar mount, so the first spotlighted target is
  // already measurable when the overlay appears.
  useEffect(() => {
    if (!shouldAutoRunWalkthrough()) return;
    const timer = setTimeout(() => setTourOpen(true), 900);
    return () => clearTimeout(timer);
  }, []);

  function closeTour() {
    setTourOpen(false);
    markWalkthroughSeen();
  }

  // No layer is visible by default — one only draws once its section is on
  // and its own switch is turned on.
  const visibility = (activeSection && sectionVisibility[activeSection]) || {};

  function toggleSection(section: string, on: boolean) {
    setActiveSection(on ? section : null);
    setSectionVisibility((v) => {
      if (!on) return { ...v, [section]: {} };
      const def = SECTIONS.find((s) => s.label === section);
      const entry = def?.layerId ? registryEntry(def.layerId) : undefined;
      // A single-layer section (Forest Cover and every theme) has nothing to
      // pick, so turning it on shows its layer straight away.
      if (entry) return { ...v, [section]: { [entry.numericId]: true } };
      return { ...v, [section]: v[section] ?? {} };
    });
  }

  // `exclusive` sections hold full-coverage imagery — stacking two opaque
  // rasters shows nothing but the top one, so turning one on turns the rest
  // of its section off.
  function toggleLayer(entry: LayerRegistryEntry, exclusive: boolean) {
    if (!activeSection) return;
    setSectionVisibility((v) => {
      const current = v[activeSection] ?? {};
      const next = exclusive ? {} : { ...current };
      next[entry.numericId] = !current[entry.numericId];
      return { ...v, [activeSection]: next };
    });
  }

  // Search result picked: unlike the switches, this has to take the layer from
  // "not even in the open section" to visible in one step — open its section
  // (which, being an accordion, closes whichever was open) and switch it on.
  // Always on, never a toggle: someone who searched for a layer wants to see
  // it, not to turn off the one they just found.
  function revealLayer(section: string, entry: LayerRegistryEntry) {
    const def = SECTIONS.find((s) => s.label === section);
    const exclusive = def?.mode === "single";
    setActiveSection(section);
    setSectionVisibility((v) => {
      const current = v[section] ?? {};
      const next = exclusive ? {} : { ...current };
      next[entry.numericId] = true;
      return { ...v, [section]: next };
    });
    setMobileSheet(null);
  }

  function changeRasterYear(layerId: string, year: number) {
    setRasterYear((y) => ({ ...y, [layerId]: year }));
  }

  const visibleFeatures = (layers ?? EMPTY).features.filter((f) => visibility[f.properties.id]);

  // Raster overlays: every switched-on raster the role can see, resolved to
  // its selected year's asset (or its one snapshot, for single-image themes
  // like Ortho/CHM/Slope/Aspect).
  const visibleRasterEntries = registryLayers
    .filter((entry) => entry.status === "available" && entry.kind === "raster")
    .filter((entry) => visibility[entry.numericId]);

  // The year a raster is showing — its explicit selection, else the newest
  // year it has, else null for a single-snapshot theme. Shared by the map
  // overlay and the Statistics panel so the two can't disagree.
  function selectedYearOf(entry: LayerRegistryEntry): number | null {
    if (!entry.rasterYears) return null;
    const years = Object.keys(entry.rasterYears).map(Number).sort((a, b) => a - b);
    return rasterYear[entry.id] ?? years[years.length - 1] ?? null;
  }

  const activeRasterLayers: ActiveRasterLayer[] = visibleRasterEntries.flatMap((entry): ActiveRasterLayer[] => {
    const opacity = entry.isPhotographic ? 1 : 0.9;
    if (entry.rasterAsset) {
      return [{ id: entry.id, url: `/${entry.rasterAsset.path}`, extent: entry.rasterAsset.extent, opacity }];
    }
    if (entry.rasterYears) {
      const year = selectedYearOf(entry);
      const asset = year != null ? entry.rasterYears[year] : undefined;
      if (!asset) return [];
      return [{ id: entry.id, url: `/${asset.path}`, extent: asset.extent, opacity }];
    }
    return [];
  });

  const legendRasterLayers = visibleRasterEntries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    isPhotographic: entry.isPhotographic,
  }));

  const statsRasterLayers: StatsRasterLayer[] = visibleRasterEntries.map((entry) => ({
    entry,
    year: selectedYearOf(entry),
  }));

  const sections = (
    <>
      {error && (
        <div className="flex flex-col items-start gap-2 px-4 py-3">
          <p className="text-sm text-destructive">Could not load layers.</p>
          <Button size="sm" variant="outline" onClick={() => setRetryTick((t) => t + 1)}>
            Retry
          </Button>
        </div>
      )}
      <SidebarSections
        role={role}
        activeSection={activeSection}
        onToggleSection={toggleSection}
        visibility={visibility}
        onToggleLayer={toggleLayer}
        rasterYear={rasterYear}
        onRasterYearChange={changeRasterYear}
        onDisabledClick={setLockedPromptSection}
      />
    </>
  );

  const infoPanel = (className: string) => (
    <MapInfoPanel
      layers={visibleFeatures}
      rasterLayers={legendRasterLayers}
      statsRasterLayers={statsRasterLayers}
      className={className}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        user={auth.user}
        onMenuClick={() => setMobileSheet("menu")}
        onLoginClick={auth.openLogin}
        onLogoutClick={auth.logout}
        onHelpClick={() => setTourOpen(true)}
        search={
          <LayerSearch role={role} visibility={visibility} onSelect={revealLayer} />
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Header mirrors this width for its brand block, so the search bar
            above lines up with the map column — keep the two in step. */}
        <aside className="hidden w-[18%] shrink-0 flex-col border-r border-border bg-sidebar xl:flex">
          <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto scrollbar-thin">
            <Sidebar variant="combined" user={auth.user} />
            <div>{sections}</div>
          </div>
          <p className="shrink-0 border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground">
            © Shetrunjay Hills {new Date().getFullYear()}
          </p>
        </aside>

        <div className="relative min-w-0 flex-1 p-4">
          <div className="relative size-full overflow-hidden rounded-2xl border border-border">
            <Map
              data={layers ?? EMPTY}
              visibility={visibility}
              rasterLayers={activeRasterLayers}
              animatedLayerIds={ANIMATED_LAYER_IDS}
            />
          </div>

          {infoPanel("absolute right-4 bottom-4 hidden max-h-[calc(100%-2rem)] w-72 xl:flex")}
        </div>
      </div>

      <nav className="flex items-center justify-around border-t border-border bg-card py-1 md:hidden">
        <Button
          variant="ghost"
          className="h-auto flex-col gap-0.5 px-3 py-1.5 text-xs"
          onClick={() => setMobileSheet("legend")}
        >
          <ListTree className="size-4" strokeWidth={1.75} />
          Legend
        </Button>
        <Button
          variant="ghost"
          className="h-auto flex-col gap-0.5 px-3 py-1.5 text-xs"
          onClick={() => setMobileSheet("menu")}
        >
          <MenuIcon className="size-4" strokeWidth={1.75} />
          Menu
        </Button>
      </nav>

      <Sheet open={mobileSheet === "menu"} onOpenChange={(o) => setMobileSheet(o ? "menu" : null)}>
        <SheetContent side="left" className="flex w-72 flex-col divide-y divide-border overflow-y-auto p-0 scrollbar-thin">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar variant="combined" user={auth.user} />
          <div>{sections}</div>
        </SheetContent>
      </Sheet>

      <Sheet open={mobileSheet === "legend"} onOpenChange={(o) => setMobileSheet(o ? "legend" : null)}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto scrollbar-thin">
          <SheetTitle className="sr-only">Legend and statistics</SheetTitle>
          {infoPanel("flex ring-0 shadow-none")}
        </SheetContent>
      </Sheet>

      <LoginDialog
        open={auth.loginOpen}
        onOpenChange={auth.setLoginOpen}
        onSuccess={auth.onLoginSuccess}
      />

      <Dialog open={lockedPromptSection !== null} onOpenChange={(o) => !o && setLockedPromptSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lockedPromptSection} is off</DialogTitle>
            <DialogDescription>
              Please enable the {lockedPromptSection} switch first to interact with these layers.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Mounted only while running: the tour always starts at step 1, so
          replaying it from the header needs no reset of its own. */}
      {tourOpen && <Walkthrough onClose={closeTour} />}
    </div>
  );
}
