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
  /** Sub-list with no data behind it, mirroring apps/web's sidebar. */
  children?: DecorativeItem[];
}

interface SectionDef {
  label: string;
  /**
   * single — full-coverage imagery, so one layer at a time within the section.
   * multi  — thin reference geometry meant to be combined.
   * year   — one layer with a year dropdown instead of an item list.
   */
  mode: "single" | "multi" | "year";
  /** year mode only: the layer the section's dropdown drives. */
  layerId?: string;
  items?: SectionItem[];
}

// Section layout mirrors apps/web/components/SidebarSections.tsx; every row is
// resolved against lib/gis-registry.ts instead of that app's hardcoded overlay
// keys, so this repo's extra layers slot into the same six sections plus a
// LiDAR one for the drone products apps/web has no data for.
export const SECTIONS: SectionDef[] = [
  {
    label: "Theme",
    mode: "single",
    items: [
      { label: "Forest Type", icon: Trees, layerId: "forest-type" },
      { label: "Green Cover", icon: Leaf, layerId: "green-cover" },
      { label: "Vegetation Change", icon: Sprout, layerId: "vegetation-change" },
      { label: "Forest Fragmentation", icon: Puzzle, layerId: "fragmentation" },
      { label: "Land Use Land Cover (LULC)", icon: Map, layerId: "lulc" },
      { label: "Forest Status", icon: Activity, layerId: "forest-boundary" },
      { label: "Cadastral Map", icon: LandPlot, layerId: "survey-number" },
      { label: "Tree Count", icon: Hash, layerId: "tree-count" },
      { label: "Tree Species Classification", icon: Tags, layerId: "tree-species" },
      { label: "Tree Height Classification", icon: Ruler, layerId: "tree-height" },
      { label: "Ecological Degradation", icon: TrendingDown, layerId: "ecological-degradation" },
      { label: "Trees Outside Forest", icon: TreePine, layerId: "tof" },
      { label: "Growing Stock", icon: Boxes, layerId: "growing-stock" },
      { label: "False Colour Composite", icon: Image, layerId: "fcc" },
    ],
  },
  {
    // Its sub-section is a single year dropdown rather than per-item switches
    // — only one year's raster shows at a time — so it carries no item list.
    label: "Forest Cover",
    mode: "year",
    layerId: "forest-cover",
  },
  {
    label: "Watershed Analysis",
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
      className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted hover:text-primary ${className ?? ""}`}
    >
      <Icon className="size-4 text-muted-foreground group-hover:text-primary" strokeWidth={1.75} />
      {label}
    </div>
  );
}

function SidebarSectionHeader({
  label,
  divider,
  right,
  tourTarget,
}: {
  label: string;
  divider: boolean;
  right?: React.ReactNode;
  tourTarget?: string;
}) {
  return (
    <div className={divider ? "mt-2 border-t border-sidebar-border pt-2" : undefined}>
      <div data-tour={tourTarget} className="flex items-center justify-between px-3 pt-2 pb-1">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
        {right}
      </div>
    </div>
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
      className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
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
    <div className="px-3 py-1.5">
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
    <div data-tour="sections" className="flex flex-col gap-2 p-4">
      {SECTIONS.map((section, i) => {
        const on = activeSection === section.label;
        const sectionEntry = section.layerId ? registryEntry(section.layerId) : undefined;

        return (
          <div key={section.label}>
            <SidebarSectionHeader
              label={section.label}
              divider={i > 0}
              // The walkthrough points at the first section as its example of
              // "switch a section on"; the rest need no target of their own.
              tourTarget={i === 0 ? "section-theme" : undefined}
              right={
                <Switch
                  size="sm"
                  checked={on}
                  onCheckedChange={(checked) => onToggleSection(section.label, checked)}
                  aria-label={`Toggle ${section.label}`}
                />
              }
            />

            {section.mode === "year" && sectionEntry ? (
              <YearControl
                label={sectionEntry.name}
                years={yearsOf(sectionEntry)}
                year={rasterYear[sectionEntry.id] ?? yearsOf(sectionEntry).at(-1) ?? null}
                enabled={on}
                onChange={(year) => onRasterYearChange(sectionEntry.id, year)}
                onDisabledClick={() => onDisabledClick(section.label)}
              />
            ) : (
              section.items?.map((item) => {
                if (item.children) {
                  return (
                    <div key={item.label}>
                      <p className="px-3 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">{item.label}</p>
                      {item.children.map((child) => (
                        <SidebarItemRow key={child.label} {...child} className="pl-6" />
                      ))}
                    </div>
                  );
                }

                const entry = item.layerId ? registryEntry(item.layerId) : undefined;
                // A layer this role can't see isn't listed at all — logging in
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
            )}
          </div>
        );
      })}
    </div>
  );
}
