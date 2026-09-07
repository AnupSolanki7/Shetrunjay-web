import {
  Trees,
  TreePine,
  Sprout,
  Leaf,
  Shrub,
  Puzzle,
  Map,
  Activity,
  LandPlot,
  Hash,
  Tags,
  Ruler,
  Waves,
  Droplets,
  Droplet,
  CloudRain,
  Route,
  TrainFront,
  Grid3x3,
  Home,
  SquareDashed,
  Compass,
  Focus,
  Cat,
  PawPrint,
  LayoutGrid,
  PieChart,
  BarChart3,
  Landmark,
  Building2,
  Footprints,
  Milestone,
  Mountain,
  Camera,
  Image,
  Boxes,
  TrendingDown,
  TrendingUp,
  Navigation,
  Waypoints,
  Construction,
  CircleDashed,
  Layers,
  Radar,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registryEntry, isVisibleToRole, type LayerRegistryEntry } from "@/lib/gis-registry";
import type { Role } from "@/lib/auth";

type DecorativeItem = { label: string; icon: LucideIcon };

interface SectionItem {
  label: string;
  icon?: LucideIcon;
  /** Registry layer this row drives (lib/gis-registry.ts). Absent = no data modelled yet. */
  layerId?: string;
  /** Sub-list with no data behind it, mirroring the reference sidebar. */
  children?: DecorativeItem[];
}

interface SectionDef {
  label: string;
  /** Shown beside the section label in its box header. */
  icon: LucideIcon;
  /**
   * layer  — the section *is* one layer: a header switch only, plus a year
   *          dropdown when that layer has multiple years.
   * single — several full-coverage rasters, so one layer at a time within
   *          the section.
   * multi  — thin reference geometry meant to be combined.
   */
  mode: "layer" | "single" | "multi";
  /** layer mode only: the layer this section switch (and year dropdown) drives. */
  layerId?: string;
  items?: SectionItem[];
}

// Every row is resolved against lib/gis-registry.ts rather than hardcoded
// overlay keys, so this repo's extra layers slot straight in.
//
// The former "Theme" section is gone: its fourteen rows were each a
// single full-coverage layer that already excluded the others, so each is now
// its own `layer` section — the shape Forest Cover always had. The accordion
// in MapDashboard keeps them mutually exclusive for free. What stays grouped
// below are the genuine groupings, where several thin geometries are meant to
// be drawn together.
export const SECTIONS: SectionDef[] = [
  { label: "Forest Cover", icon: Trees, mode: "layer", layerId: "forest-cover" },
  { label: "Forest Type", icon: Trees, mode: "layer", layerId: "forest-type" },
  { label: "Green Cover", icon: Leaf, mode: "layer", layerId: "green-cover" },
  { label: "Vegetation Change", icon: Sprout, mode: "layer", layerId: "vegetation-change" },
  { label: "Forest Fragmentation", icon: Puzzle, mode: "layer", layerId: "fragmentation" },
  { label: "Land Use Land Cover (LULC)", icon: Map, mode: "layer", layerId: "lulc" },
  { label: "Forest Status", icon: Activity, mode: "layer", layerId: "forest-boundary" },
  { label: "Cadastral Map", icon: LandPlot, mode: "layer", layerId: "survey-number" },
  { label: "Tree Count", icon: Hash, mode: "layer", layerId: "tree-count" },
  { label: "Tree Species Classification", icon: Tags, mode: "layer", layerId: "tree-species" },
  { label: "Tree Height Classification", icon: Ruler, mode: "layer", layerId: "tree-height" },
  { label: "Ecological Degradation", icon: TrendingDown, mode: "layer", layerId: "ecological-degradation" },
  { label: "Trees Outside Forest", icon: TreePine, mode: "layer", layerId: "tof" },
  { label: "Growing Stock", icon: Boxes, mode: "layer", layerId: "growing-stock" },
  { label: "False Colour Composite", icon: Image, mode: "layer", layerId: "fcc" },
  {
    label: "Watershed Analysis",
    icon: Droplets,
    mode: "multi",
    items: [
      { label: "Streams", icon: Waves, layerId: "streams" },
      { label: "Watershed", icon: Droplets, layerId: "catchments" },
      { label: "Flood", icon: CloudRain, layerId: "flood" },
      { label: "Vantalavadi", icon: Shrub, layerId: "smc-vantalavadi" },
      { label: "Matipala", icon: Mountain, layerId: "smc-matipala" },
      { label: "Checkdam", icon: Waypoints, layerId: "smc-checkdam" },
      { label: "Causeway", icon: Construction, layerId: "smc-causeway" },
      { label: "Potential SMC", icon: CircleDashed, layerId: "potential-smc" },
    ],
  },
  {
    label: "Base Layers",
    icon: Layers,
    mode: "multi",
    items: [
      { label: "Roads", icon: Route, layerId: "roads" },
      { label: "Rivers", icon: Waves, layerId: "rivers" },
      { label: "Railways", icon: TrainFront, layerId: "railways" },
      { label: "Canals", icon: Droplet, layerId: "canals" },
      { label: "Grid", icon: Grid3x3, layerId: "grids" },
      { label: "Village Boundaries", icon: Home, layerId: "village" },
      { label: "Zone Boundaries", icon: SquareDashed, layerId: "zones" },
      { label: "District", icon: Landmark, layerId: "district" },
      { label: "Taluka", icon: Building2, layerId: "taluka" },
      { label: "Tracks", icon: Footprints, layerId: "tracks" },
      { label: "Steps", icon: Milestone, layerId: "steps" },
      { label: "Forest", icon: TreePine, layerId: "forest" },
      { label: "SOI Toposheets", icon: Compass },
      { label: "Study Area", icon: Focus, layerId: "study-area" },
    ],
  },
  {
    label: "LiDAR / Drone",
    icon: Radar,
    mode: "single",
    items: [
      { label: "Ortho (Orthomosaic)", icon: Camera, layerId: "ortho" },
      { label: "DSM", icon: Mountain, layerId: "dsm" },
      { label: "DTM", icon: Mountain, layerId: "dtm" },
      { label: "CHM", icon: Trees, layerId: "chm" },
      { label: "Slope", icon: TrendingUp, layerId: "slope" },
      { label: "Aspect", icon: Navigation, layerId: "aspect" },
    ],
  },
  {
    label: "Wildlife Corridor",
    icon: PawPrint,
    mode: "multi",
    items: [
      { label: "Corridor Mapping", icon: Route, layerId: "corridor-mapping" },
      { label: "Habitat Suitability", icon: PawPrint, layerId: "habitat-suitability" },
      {
        label: "Fauna Selection",
        children: [
          { label: "Lion", icon: Cat },
          { label: "Leopard", icon: PawPrint },
        ],
      },
    ],
  },
  {
    label: "Carbon Stock",
    icon: PieChart,
    mode: "multi",
    items: [
      { label: "AGB", icon: Boxes, layerId: "agb" },
      { label: "Carbon Stock", icon: PieChart, layerId: "carbon-stock" },
      {
        label: "Outputs",
        children: [
          { label: "Zone-wise Carbon Stock", icon: LayoutGrid },
          { label: "Overall Carbon Stock", icon: PieChart },
          { label: "Summary Statistics", icon: BarChart3 },
        ],
      },
    ],
  },
];

function yearsOf(entry: LayerRegistryEntry): number[] {
  return entry.rasterYears ? Object.keys(entry.rasterYears).map(Number).sort((a, b) => a - b) : [];
}

function SidebarItemRow({
  label,
  icon: Icon,
  className,
}: {
  label: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground/80 hover:bg-muted hover:text-primary ${className ?? ""}`}
    >
      <Icon className="size-4 text-muted-foreground group-hover:text-primary" strokeWidth={1.75} />
      {label}
    </div>
  );
}

// Each section is a bordered box with a tinted header strip, so a column of
// twenty of them still reads as twenty discrete groups rather than one long
// undifferentiated run of rows. `children` is what sits inside the box below
// the header — a section that is a bare switch (a pending theme, or a
// single-snapshot one) has none, and then the box is only its header.
function SidebarSectionBox({
  label,
  icon: Icon,
  right,
  tourTarget,
  children,
}: {
  label: string;
  icon: LucideIcon;
  right?: React.ReactNode;
  tourTarget?: string;
  children?: React.ReactNode;
}) {
  const hasBody = Boolean(children);

  return (
    <section
      data-tour={tourTarget}
      className="overflow-hidden rounded-lg border border-sidebar-border bg-sidebar"
    >
      <header
        className={`flex items-center justify-between gap-2 bg-muted/70 px-2.5 py-2 ${
          hasBody ? "border-b border-sidebar-border" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
          <p className="truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {label}
          </p>
        </span>
        {right}
      </header>
      {hasBody && <div className="p-1">{children}</div>}
    </section>
  );
}

function ToggleItemRow({
  label,
  icon: Icon,
  enabled,
  pending,
  checked,
  onActivate,
}: {
  label: string;
  icon?: LucideIcon;
  enabled: boolean;
  pending: boolean;
  checked: boolean;
  onActivate: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={!enabled}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        enabled
          ? "cursor-pointer text-foreground/80 hover:bg-muted hover:text-primary"
          : "cursor-not-allowed text-muted-foreground/60"
      }`}
    >
      {Icon && (
        <Icon
          className={`size-4 ${enabled ? "text-muted-foreground group-hover:text-primary" : "text-muted-foreground/60"}`}
          strokeWidth={1.75}
        />
      )}
      <span className="flex-1">{label}</span>
      {pending ? (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          Pending
        </Badge>
      ) : (
        <Switch size="sm" checked={checked} aria-disabled={!enabled} aria-label={`Toggle ${label} layer`} tabIndex={-1} />
      )}
    </div>
  );
}

// Multi-year rasters show one year at a time, so the year is a dropdown rather
// than another set of switches.
function YearControl({
  label,
  years,
  year,
  enabled,
  onChange,
  onDisabledClick,
}: {
  label: string;
  years: number[];
  year: number | null;
  enabled: boolean;
  onChange: (year: number) => void;
  onDisabledClick: () => void;
}) {
  return (
    <div className="px-1.5 py-1">
      <span className="mb-1 block text-xs text-muted-foreground/80">Year</span>
      {enabled ? (
        <Select value={year != null ? String(year) : undefined} onValueChange={(v) => onChange(Number(v))}>
          <SelectTrigger className="h-8 w-full text-sm" aria-label={`Select ${label} year`}>
            <SelectValue placeholder="Select a year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <button
          type="button"
          onClick={onDisabledClick}
          className="flex h-8 w-full cursor-not-allowed items-center rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground/60"
        >
          {year ?? "Select a year"}
        </button>
      )}
    </div>
  );
}

export function SidebarSections({
  role,
  activeSection,
  onToggleSection,
  visibility,
  onToggleLayer,
  rasterYear,
  onRasterYearChange,
  onDisabledClick,
}: {
  role: Role | null;
  activeSection: string | null;
  onToggleSection: (section: string, on: boolean) => void;
  visibility: Record<number, boolean>;
  onToggleLayer: (entry: LayerRegistryEntry, exclusive: boolean) => void;
  rasterYear: Record<string, number>;
  onRasterYearChange: (layerId: string, year: number) => void;
  onDisabledClick: (section: string) => void;
}) {
  return (
    <div data-tour="sections" className="flex flex-col gap-2 p-3">
      {SECTIONS.map((section, i) => {
        const on = activeSection === section.label;
        const sectionEntry = section.layerId ? registryEntry(section.layerId) : undefined;

        // A single-layer section this role cannot see is not listed at all —
        // logging in is what makes the restricted ones appear, the same rule
        // the individual rows inside the grouped sections follow.
        if (section.mode === "layer" && (!sectionEntry || !isVisibleToRole(sectionEntry, role))) {
          return null;
        }

        const sectionPending = section.mode === "layer" && sectionEntry!.status !== "available";
        const sectionYears = sectionEntry ? yearsOf(sectionEntry) : [];

        // Grouped sections list their rows. A role that can see none of them
        // gets a header-only box rather than an empty one.
        const rows = (section.items ?? [])
          .map((item) => {
            if (item.children) {
              return (
                <div key={item.label}>
                  <p className="px-2.5 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">
                    {item.label}
                  </p>
                  {item.children.map((child) => (
                    <SidebarItemRow key={child.label} {...child} className="pl-5" />
                  ))}
                </div>
              );
            }

            const entry = item.layerId ? registryEntry(item.layerId) : undefined;
            // A layer this role cannot see is not listed either — logging in
            // is what makes the restricted rows appear.
            if (entry && !isVisibleToRole(entry, role)) return null;

            const pending = !entry || entry.status !== "available";
            const checked = Boolean(entry && visibility[entry.numericId]);
            const years = entry ? yearsOf(entry) : [];

            return (
              <div key={item.label}>
                <ToggleItemRow
                  label={item.label}
                  icon={item.icon}
                  enabled={on && !pending}
                  pending={pending}
                  checked={checked}
                  onActivate={() => {
                    if (!on) onDisabledClick(section.label);
                    else if (entry && !pending) onToggleLayer(entry, section.mode === "single");
                  }}
                />
                {checked && entry && years.length > 0 && (
                  <YearControl
                    label={entry.name}
                    years={years}
                    year={rasterYear[entry.id] ?? years.at(-1) ?? null}
                    enabled={on}
                    onChange={(year) => onRasterYearChange(entry.id, year)}
                    onDisabledClick={() => onDisabledClick(section.label)}
                  />
                )}
              </div>
            );
          })
          .filter(Boolean);

        // Only a multi-year layer has anything to put inside a single-layer
        // box; a single-snapshot or pending one is header-only.
        const body =
          section.mode === "layer" ? (
            !sectionPending && sectionYears.length > 0 ? (
              <YearControl
                label={sectionEntry!.name}
                years={sectionYears}
                year={rasterYear[sectionEntry!.id] ?? sectionYears.at(-1) ?? null}
                enabled={on}
                onChange={(year) => onRasterYearChange(sectionEntry!.id, year)}
                onDisabledClick={() => onDisabledClick(section.label)}
              />
            ) : null
          ) : rows.length > 0 ? (
            rows
          ) : null;

        return (
          <SidebarSectionBox
            key={section.label}
            label={section.label}
            icon={section.icon}
            // The walkthrough points at the first section as its example of
            // "switch a section on"; the rest need no target of their own.
            tourTarget={i === 0 ? "section-theme" : undefined}
            right={
              sectionPending ? (
                <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                  Pending
                </Badge>
              ) : (
                <Switch
                  size="sm"
                  checked={on}
                  onCheckedChange={(checked) => onToggleSection(section.label, checked)}
                  aria-label={`Toggle ${section.label}`}
                />
              )
            }
          >
            {body}
          </SidebarSectionBox>
        );
      })}
    </div>
  );
}
