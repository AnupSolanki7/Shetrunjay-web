"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Map as MapIcon,
  Layers,
  ListTree,
  TreePine,
  Menu as MenuIcon,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { LoginDialog } from "@/components/LoginDialog";
import { LayerPanel } from "@/components/LayerPanel";
import { LegendCard } from "@/components/LegendCard";
import { ThemeFilterPanel } from "@/components/ThemeFilterPanel";
import { ForestCoverPanel } from "@/components/ForestCoverPanel";
import { getToken, type Role } from "@/lib/auth";
import { useAuthState } from "@/hooks/use-auth-state";
import { fetchLayers, UnauthorizedError, type LayerCollection } from "@/lib/layers-api";
import { registryForRole, registryEntry } from "@/lib/gis-registry";
import { themesForRole } from "@/lib/themes";
import { getYearColor, type ForestCoverYear, type ForestCoverSource } from "@/lib/forest-cover-mock";
import { cn } from "@/lib/utils";
import type { ThemeOverlay, ActiveRasterLayer } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const EMPTY: LayerCollection = { type: "FeatureCollection", features: [] };

type MobileSheet = "menu" | "layers" | "legend" | "themes" | null;

export function MapDashboard() {
  const auth = useAuthState();
  const [layers, setLayers] = useState<LayerCollection | null>(null);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [visibility, setVisibility] = useState<Record<number, boolean>>({});
  const [rasterYear, setRasterYear] = useState<Record<string, number>>({});
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [forestCoverYear, setForestCoverYear] = useState<ForestCoverYear | null>(null);
  const [forestCoverSource, setForestCoverSource] = useState<ForestCoverSource | null>(null);
  const [forestCoverLayerOn, setForestCoverLayerOn] = useState(false);

  const token = getToken();
  const loading = layers === null && !error;
  // Unsigned demo token, decoded client-side only — same trust model as
  // lib/layers-api.ts's own roleFromToken().
  const role = (auth.user?.role as Role | undefined) ?? null;
  const registryLayers = registryForRole(role);
  const themes = themesForRole(role);

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

  function toggleVisibility(id: number, currentlyVisible: boolean) {
    setVisibility((v) => ({ ...v, [id]: !currentlyVisible }));
  }

  function changeRasterYear(id: string, year: number) {
    setRasterYear((y) => ({ ...y, [id]: year }));
  }

  // Themes are a curated entry point to a single layer: selecting one turns
  // its layer on and turns the previously selected theme's layer back off.
  // Both write the same `visibility` state the layer panel reads, so the two
  // surfaces can't drift out of sync.
  function selectTheme(key: string | null) {
    const previous = themes.find((t) => t.key === selectedTheme);
    const next = themes.find((t) => t.key === key);

    setVisibility((v) => {
      const updated = { ...v };
      const previousEntry = previous && registryEntry(previous.layerId);
      const nextEntry = next && registryEntry(next.layerId);
      if (previousEntry) updated[previousEntry.numericId] = false;
      if (nextEntry) updated[nextEntry.numericId] = true;
      return updated;
    });

    setSelectedTheme(key);
  }

  const visibleLayers = (layers ?? EMPTY).features;

  // Raster overlays: every available raster layer the role can see and that
  // isn't toggled off, resolved to its currently-selected year's asset (or
  // its one snapshot, for single-image themes like Ortho/CHM/Slope/Aspect).
  const visibleRasterEntries = registryLayers
    .filter((entry) => entry.status === "available" && entry.kind === "raster")
    .filter((entry) => visibility[entry.numericId] ?? false);

  const activeRasterLayers: ActiveRasterLayer[] = visibleRasterEntries.flatMap((entry): ActiveRasterLayer[] => {
    const opacity = entry.isPhotographic ? 1 : 0.9;
    if (entry.rasterAsset) {
      return [{ id: entry.id, url: `/${entry.rasterAsset.path}`, extent: entry.rasterAsset.extent, opacity }];
    }
    if (entry.rasterYears) {
      const years = Object.keys(entry.rasterYears).map(Number).sort((a, b) => a - b);
      const year = rasterYear[entry.id] ?? years[years.length - 1];
      const asset = entry.rasterYears[year];
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

  // Forest Cover (FRD §1.1): the "satellite/drone layer" is a placeholder
  // tint over the real hill boundary geometry, standing in for imagery that
  // doesn't exist yet — swapped per year so the map visibly responds to the
  // year filter.
  const boundaryFeature = visibleLayers.find((f) => f.properties.layerId === "study-area");
  const themeOverlay: ThemeOverlay | null =
    selectedTheme === "forest_cover" && boundaryFeature && forestCoverYear
      ? {
          geometry: boundaryFeature.geometry,
          color: getYearColor(forestCoverYear),
          visible: forestCoverLayerOn,
        }
      : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        user={auth.user}
        onMenuClick={() => setMobileSheet("menu")}
        onLoginClick={auth.openLogin}
        onLogoutClick={auth.logout}
      />

      <div className="relative min-h-0 flex-1">
        <Map
          data={layers ?? EMPTY}
          visibility={visibility}
          onToggleLayers={() => setMobileSheet((s) => (s === "layers" ? null : "layers"))}
          themeOverlay={themeOverlay}
          rasterLayers={activeRasterLayers}
        />

        {sidebarCollapsed ? (
          <div className="absolute top-4 left-4 z-20 hidden xl:block">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full shadow-sm ring-1 ring-foreground/10"
              aria-label="Expand sidebar"
              onClick={() => setSidebarCollapsed(false)}
            >
              <PanelLeftOpen />
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "absolute top-4 left-4 z-20 hidden w-72 max-h-[calc(100%-2rem)] flex-col divide-y divide-border overflow-y-auto scrollbar-thin rounded-xl bg-card shadow-sm ring-1 ring-foreground/10 xl:flex",
            )}
          >
            <Sidebar
              variant="combined"
              user={auth.user}
              onLoginClick={auth.openLogin}
              onLogoutClick={auth.logout}
              onCollapse={() => setSidebarCollapsed(true)}
            />
            <ThemeFilterPanel
              themes={themes}
              selectedTheme={selectedTheme}
              onSelectTheme={selectTheme}
              bare
            />
            <LayerPanel
              layers={registryLayers}
              loading={loading}
              error={error}
              visibility={visibility}
              onToggle={toggleVisibility}
              rasterYear={rasterYear}
              onRasterYearChange={changeRasterYear}
              onRetry={() => setRetryTick((t) => t + 1)}
              bare
            />
          </div>
        )}

        {selectedTheme === "forest_cover" && (
          <ForestCoverPanel
            year={forestCoverYear}
            onYearChange={setForestCoverYear}
            source={forestCoverSource}
            onSourceChange={setForestCoverSource}
            layerOn={forestCoverLayerOn}
            onLayerOnChange={setForestCoverLayerOn}
            className="absolute top-4 right-4 hidden w-72 xl:flex"
          />
        )}

        <LegendCard
          layers={visibleLayers}
          rasterLayers={legendRasterLayers}
          className="absolute right-4 bottom-4 hidden max-h-[calc(100%-2rem)] w-64 overflow-y-auto scrollbar-thin xl:flex"
        />
      </div>

      <nav className="flex items-center justify-around border-t border-border bg-card py-1 md:hidden">
        <Button
          variant="ghost"
          className="h-auto flex-col gap-0.5 px-3 py-1.5 text-xs"
          onClick={() => setMobileSheet(null)}
        >
          <MapIcon className="size-4" strokeWidth={1.75} />
          Map
        </Button>
        <Button
          variant="ghost"
          className="h-auto flex-col gap-0.5 px-3 py-1.5 text-xs"
          onClick={() => setMobileSheet("themes")}
        >
          <TreePine className="size-4" strokeWidth={1.75} />
          Themes
        </Button>
        <Button
          variant="ghost"
          className="h-auto flex-col gap-0.5 px-3 py-1.5 text-xs"
          onClick={() => setMobileSheet("layers")}
        >
          <Layers className="size-4" strokeWidth={1.75} />
          Layers
        </Button>
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
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            user={auth.user}
            variant="embedded"
            onLoginClick={() => {
              setMobileSheet(null);
              auth.openLogin();
            }}
            onLogoutClick={auth.logout}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={mobileSheet === "themes"} onOpenChange={(o) => setMobileSheet(o ? "themes" : null)}>
        <SheetContent side="bottom" className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto scrollbar-thin">
          <SheetTitle className="sr-only">Themes</SheetTitle>
          <ThemeFilterPanel themes={themes} selectedTheme={selectedTheme} onSelectTheme={selectTheme} />
          {selectedTheme === "forest_cover" && (
            <ForestCoverPanel
              year={forestCoverYear}
              onYearChange={setForestCoverYear}
              source={forestCoverSource}
              onSourceChange={setForestCoverSource}
              layerOn={forestCoverLayerOn}
              onLayerOnChange={setForestCoverLayerOn}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={mobileSheet === "layers"} onOpenChange={(o) => setMobileSheet(o ? "layers" : null)}>
        <SheetContent side="bottom" className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto scrollbar-thin">
          <SheetTitle className="sr-only">Layers</SheetTitle>
          <LayerPanel
            layers={registryLayers}
            loading={loading}
            error={error}
            visibility={visibility}
            onToggle={toggleVisibility}
            rasterYear={rasterYear}
            onRasterYearChange={changeRasterYear}
            onRetry={() => setRetryTick((t) => t + 1)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={mobileSheet === "legend"} onOpenChange={(o) => setMobileSheet(o ? "legend" : null)}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto scrollbar-thin">
          <SheetTitle className="sr-only">Legend</SheetTitle>
          <LegendCard layers={visibleLayers} rasterLayers={legendRasterLayers} className="flex" />
        </SheetContent>
      </Sheet>

      <LoginDialog
        open={auth.loginOpen}
        onOpenChange={auth.setLoginOpen}
        onSuccess={auth.onLoginSuccess}
      />
    </div>
  );
}
