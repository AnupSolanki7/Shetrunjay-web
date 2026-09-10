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
  Image,
  Boxes,
  TrendingDown,
  Waypoints,
  Construction,
  CircleDashed,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { registryEntry, isVisibleToRole, type LayerRegistryEntry } from "@/lib/gis-registry";
import { colorForLayer } from "@/lib/layer-style";
import { cn } from "@/lib/utils";
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

/**
 * Subject colour for a section, resolved to the --sec-* tokens in globals.css.
 * Twenty sections sharing one brand gold gave the panel nothing to navigate
 * by; a hue per subject makes it scannable — and the grouping is meaningful,
 * not decorative (everything green is cover, everything teal is a per-tree
 * metric, blue is water).
 */
type SectionAccent =
  | "forest"
  | "canopy"
  | "change"
  | "land"
  | "imagery"
  | "water"
  | "infra"
  | "fauna"
  | "carbon";

// Written out as whole class strings because Tailwind scans for literals —
// a template built from the accent name at runtime would generate nothing.
const ACCENT_STYLES: Record<
  SectionAccent,
  { chip: string; idle: string; header: string; edge: string }
> = {
  forest: {
    chip: "bg-sec-forest/14 text-sec-forest ring-sec-forest/30",
    idle: "from-sec-forest/8 to-sec-forest/2",
    header: "from-sec-forest/24 to-sec-forest/7",
    edge: "border-sec-forest/45 ring-sec-forest/20",
  },
  canopy: {
    chip: "bg-sec-canopy/14 text-sec-canopy ring-sec-canopy/30",
    idle: "from-sec-canopy/8 to-sec-canopy/2",
    header: "from-sec-canopy/24 to-sec-canopy/7",
    edge: "border-sec-canopy/45 ring-sec-canopy/20",
  },
  change: {
    chip: "bg-sec-change/14 text-sec-change ring-sec-change/30",
    idle: "from-sec-change/8 to-sec-change/2",
    header: "from-sec-change/24 to-sec-change/7",
    edge: "border-sec-change/45 ring-sec-change/20",
  },
  land: {
    chip: "bg-sec-land/14 text-sec-land ring-sec-land/30",
    idle: "from-sec-land/8 to-sec-land/2",
    header: "from-sec-land/24 to-sec-land/7",
    edge: "border-sec-land/45 ring-sec-land/20",
  },
  imagery: {
    chip: "bg-sec-imagery/14 text-sec-imagery ring-sec-imagery/30",
    idle: "from-sec-imagery/8 to-sec-imagery/2",
    header: "from-sec-imagery/24 to-sec-imagery/7",
    edge: "border-sec-imagery/45 ring-sec-imagery/20",
  },
  water: {
    chip: "bg-sec-water/14 text-sec-water ring-sec-water/30",
    idle: "from-sec-water/8 to-sec-water/2",
    header: "from-sec-water/24 to-sec-water/7",
    edge: "border-sec-water/45 ring-sec-water/20",
  },
  infra: {
    chip: "bg-sec-infra/14 text-sec-infra ring-sec-infra/30",
    idle: "from-sec-infra/8 to-sec-infra/2",
    header: "from-sec-infra/24 to-sec-infra/7",
    edge: "border-sec-infra/45 ring-sec-infra/20",
  },
  fauna: {
    chip: "bg-sec-fauna/14 text-sec-fauna ring-sec-fauna/30",
    idle: "from-sec-fauna/8 to-sec-fauna/2",
    header: "from-sec-fauna/24 to-sec-fauna/7",
    edge: "border-sec-fauna/45 ring-sec-fauna/20",
  },
  carbon: {
    chip: "bg-sec-carbon/14 text-sec-carbon ring-sec-carbon/30",
    idle: "from-sec-carbon/8 to-sec-carbon/2",
    header: "from-sec-carbon/24 to-sec-carbon/7",
    edge: "border-sec-carbon/45 ring-sec-carbon/20",
  },
};

interface SectionDef {
  label: string;
  /** Shown beside the section label in its box header. */
  icon: LucideIcon;
  /** Subject colour — see SectionAccent. */
  accent: SectionAccent;
  /**
   * layer  — the section *is* one layer: a header switch only, plus a year
   *          dropdown when that layer has multiple years.
   * single — several full-coverage rasters, so one layer at a time within
   *          the section. No section uses this at present (the LiDAR / Drone
   *          group that did has been removed), but the exclusivity it drives
   *          is still wired up for the next multi-raster group.
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
  { label: "Forest Cover", icon: Trees, accent: "forest", mode: "layer", layerId: "forest-cover" },
  { label: "Forest Type", icon: Trees, accent: "forest", mode: "layer", layerId: "forest-type" },
  { label: "Green Cover", icon: Leaf, accent: "forest", mode: "layer", layerId: "green-cover" },
  { label: "Vegetation Change", icon: Sprout, accent: "change", mode: "layer", layerId: "vegetation-change" },
  { label: "Forest Fragmentation", icon: Puzzle, accent: "change", mode: "layer", layerId: "fragmentation" },
  { label: "Land Use Land Cover (LULC)", icon: Map, accent: "land", mode: "layer", layerId: "lulc" },
  { label: "Forest Status", icon: Activity, accent: "forest", mode: "layer", layerId: "forest-boundary" },
  { label: "Cadastral Map", icon: LandPlot, accent: "land", mode: "layer", layerId: "survey-number" },
  { label: "Tree Count", icon: Hash, accent: "canopy", mode: "layer", layerId: "tree-count" },
  { label: "Tree Species Classification", icon: Tags, accent: "canopy", mode: "layer", layerId: "tree-species" },
  { label: "Tree Height Classification", icon: Ruler, accent: "canopy", mode: "layer", layerId: "tree-height" },
  { label: "Ecological Degradation", icon: TrendingDown, accent: "change", mode: "layer", layerId: "ecological-degradation" },
  { label: "Trees Outside Forest", icon: TreePine, accent: "forest", mode: "layer", layerId: "tof" },
  { label: "Growing Stock", icon: Boxes, accent: "canopy", mode: "layer", layerId: "growing-stock" },
  { label: "False Colour Composite", icon: Image, accent: "imagery", mode: "layer", layerId: "fcc" },
  {
    label: "Watershed Analysis",
    accent: "water",
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
    accent: "infra",
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
    label: "Wildlife Corridor",
    accent: "fauna",
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
    accent: "carbon",
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
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-primary",
        className,
      )}
    >
      <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" strokeWidth={1.75} />
      {label}
    </div>
  );
}

// Each section is a raised box with a tinted header strip, so a column of
// twenty of them still reads as twenty discrete groups rather than one long
// undifferentiated run of rows. `children` is what sits inside the box below
// the header — a section that is a bare switch (a pending theme, or a
// single-snapshot one) has none, and then the box is only its header.
//
// The icon chip always carries the section's subject colour, which is what
// makes a column of twenty boxes scannable at a glance. `active` then layers
// the same hue over the whole box — washed header, tinted border and ring,
// and a lift off the page — so with only one section open at a time the open
// one is unmistakable. Before this it was near identical to the closed ones.
function SidebarSectionBox({
  label,
  icon: Icon,
  accent,
  active,
  right,
  tourTarget,
  children,
}: {
  label: string;
  icon: LucideIcon;
  accent: SectionAccent;
  active: boolean;
  right?: React.ReactNode;
  tourTarget?: string;
  children?: React.ReactNode;
}) {
  const hasBody = Boolean(children);
  const style = ACCENT_STYLES[accent];

  return (
    <section
      data-tour={tourTarget}
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-all duration-200",
        active
          ? cn("shadow-e3 ring-1", style.edge)
          : "border-border/70 shadow-e2 hover:border-border hover:shadow-e3",
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-2 px-2.5 py-2 transition-colors",
          // Both states wash the header in the section's own hue; the open
          // one just does it three times as strongly, which — with the ring
          // and the extra lift — is what still sets it apart.
          "bg-linear-to-b",
          active ? style.header : style.idle,
          hasBody && (active ? "border-b border-border/60" : "border-b border-border/50"),
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition-colors",
              style.chip,
            )}
          >
            <Icon className="size-3" strokeWidth={2.25} />
          </span>
          <p
            className={cn(
              "truncate text-[11px] font-semibold tracking-wider uppercase transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
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
  color,
  enabled,
  pending,
  checked,
  onActivate,
}: {
  label: string;
  icon?: LucideIcon;
  /**
   * The colour this layer actually renders in on the map, so the row is a
   * key as well as a switch — the same trick the client's own reference
   * sidebar uses. Absent for pending rows, which draw nothing to key.
   */
  color?: string;
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
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        !enabled && "cursor-not-allowed text-muted-foreground/60",
        // A checked row keeps the tint whether or not the pointer is on it,
        // so you can read off what is drawn without hunting for lit switches.
        enabled && checked && "cursor-pointer bg-primary/12 font-medium text-foreground",
        enabled && !checked && "cursor-pointer text-foreground/80 hover:bg-primary/8 hover:text-primary",
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "size-4 transition-colors",
            !enabled && "text-muted-foreground/60",
            // Without a colour of its own the icon falls back to the old
            // grey-to-gold hover.
            enabled && !color && (checked ? "text-primary" : "text-muted-foreground group-hover:text-primary"),
          )}
          style={enabled && color ? { color } : undefined}
          strokeWidth={1.75}
        />
      )}
      <span className="flex-1">{label}</span>
      {pending ? (
        <Badge
          variant="outline"
          className="border-border/70 bg-muted/70 text-[10px] font-medium text-muted-foreground"
        >
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
    <div data-tour="sections" className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-panel/85 px-4 py-2.5 backdrop-blur-sm">
        <Layers className="size-3.5 shrink-0 text-primary" strokeWidth={2.25} />
        <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground/70 uppercase">
          Map Layers
        </p>
        {activeSection && (
          <span className="ml-auto min-w-0 truncate rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/25">
            {activeSection}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
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
                  color={entry && !pending ? colorForLayer(entry) : undefined}
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
            accent={section.accent}
            active={on}
            // The walkthrough points at the first section as its example of
            // "switch a section on"; the rest need no target of their own.
            tourTarget={i === 0 ? "section-theme" : undefined}
            right={
              sectionPending ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-border/70 bg-muted/70 text-[10px] font-medium text-muted-foreground"
                >
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
    </div>
  );
}
