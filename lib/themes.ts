import type { Role } from "@/lib/auth";
import { isVisibleToRole, registryEntry } from "@/lib/gis-registry";

// The 14-theme catalog from the FRD (§1). Each theme is a curated entry point
// to one registry layer — selecting it turns that layer on. A theme is enabled
// once its layer has real data and the current role is allowed to see it;
// until then it stays listed but disabled, so the catalog reads the same for
// everyone.
export interface ThemeDef {
  key: string;
  label: string;
  /** Registry layer this theme drives (lib/gis-registry.ts). */
  layerId: string;
  enabled: boolean;
}

const THEME_LAYERS: ReadonlyArray<{ key: string; label: string; layerId: string }> = [
  { key: "forest_cover", label: "Forest Cover", layerId: "forest-cover" },
  { key: "forest_type", label: "Forest Type", layerId: "forest-type" },
  { key: "vegetation_change", label: "Vegetation Change", layerId: "vegetation-change" },
  { key: "fragmentation", label: "Fragmentation", layerId: "fragmentation" },
  { key: "lulc", label: "LULC", layerId: "lulc" },
  { key: "forest_status", label: "Forest Status", layerId: "forest-boundary" },
  { key: "cadastral_map", label: "Cadastral Map", layerId: "survey-number" },
  { key: "tree_count", label: "Tree Count", layerId: "tree-count" },
  { key: "tree_species", label: "Tree Species", layerId: "tree-species" },
  { key: "tree_height", label: "Tree Height Classification", layerId: "tree-height" },
  { key: "watershed", label: "Watershed", layerId: "catchments" },
  { key: "wildlife_corridor", label: "Wildlife Corridor", layerId: "corridor-mapping" },
  { key: "habitat_suitability", label: "Habitat Suitability Model", layerId: "habitat-suitability" },
  { key: "carbon_stock", label: "Carbon Stock", layerId: "carbon-stock" },
];

export function themesForRole(role: Role | null): ThemeDef[] {
  return THEME_LAYERS.map((theme) => {
    const entry = registryEntry(theme.layerId);
    return {
      ...theme,
      enabled: Boolean(entry && entry.status === "available" && isVisibleToRole(entry, role)),
    };
  });
}
