import type { Role } from "@/lib/auth";

// Source of truth for every GIS layer in the Shetrunjay dashboard, whether or
// not real data has arrived yet. Rows with status "pending" render disabled
// in the layer panel rather than disappearing — see PROJECT.md for the data
// inventory this was built from.

export type LayerKind = "raster" | "vector" | "pending";
export type LayerStatus = "available" | "pending";

// "public" includes anonymous visitors, matching layersForRole()'s existing
// public/authenticated split. A role list restricts to exactly those roles.
export type LayerVisibility = "public" | Role[];

const AUTHENTICATED: Role[] = ["regular_user", "admin", "support_team"];

// Raster corner extents come straight from the delivered EXTENT.docx files
// (EPSG:4326, confirmed in the docs themselves) — each year of a theme can
// have a very slightly different extent, so it's per-asset, not per-layer.
export interface RasterExtent {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface RasterYearAsset {
  /** Relative to public/. */
  path: string;
  extent: RasterExtent;
  /** Vegetation Change only — the earlier year this one is compared against. */
  compareYear?: number;
}

export interface RasterAsset {
  path: string;
  extent: RasterExtent;
}

export interface LayerRegistryEntry {
  /** Stable string id, e.g. "survey-number". */
  id: string;
  /** Stable numeric id (declaration order) — layer panel/map color + toggle key. */
  numericId: number;
  name: string;
  group: string;
  kind: LayerKind;
  status: LayerStatus;
  /** Relative to public/, e.g. "gis/vector/roads.geojson". Available layers only. */
  assetPath?: string;
  /** Multi-year raster themes — one image + extent per year, keyed by year. */
  rasterYears?: Record<number, RasterYearAsset>;
  /** Single-snapshot raster themes (no year selector) — Ortho, CHM, Slope, Aspect, DTM/DSM. */
  rasterAsset?: RasterAsset;
  /** True for a plain RGB/photographic raster (FCC, Ortho) — no class legend to show. */
  isPhotographic?: boolean;
  /** Popup/attribute fields, exact casing as found in the source data. */
  attributeFields?: string[];
  /** Dominant geometry type — drives the layer-panel/legend swatch shape. Available vector layers only. */
  geometryKind?: "point" | "line" | "polygon";
  visibility: LayerVisibility;
}

const REGISTRY_DEFINITIONS: Omit<LayerRegistryEntry, "numericId">[] = [
  // --- Obj 1: Forest / vegetation cover -----------------------------------
  // Forest Cover is the 5-class density classification (Very Dense /
  // Moderately Dense / Open Forest / Scrub / Non-Forest) — the client's
  // colour doc calls that section "DENSITY classes", and the imagery's own
  // palette matches it exactly. Distinct from Green Cover below, which is the
  // 2-class binary; the two share one source folder but are different themes.
  //
  // NOTE: no extent is documented for Forest Cover anywhere. These are the
  // LULC / Green Cover per-year extents, which are byte-identical to each
  // other and derived from the same source imagery — inferred, not supplied.
  // Replace if the client provides a Forest Cover extent doc.
  {
    id: "forest-cover",
    name: "Forest Cover",
    group: "Obj 1 — Forest Cover",
    kind: "raster",
    status: "available",
    rasterYears: {
      1980: { path: "gis/raster/forest-cover/1980.png", extent: { west: 71.72702, south: 21.452038, east: 71.82322, north: 21.512114 } },
      1989: { path: "gis/raster/forest-cover/1989.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      1998: { path: "gis/raster/forest-cover/1998.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2008: { path: "gis/raster/forest-cover/2008.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2018: { path: "gis/raster/forest-cover/2018.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2025: { path: "gis/raster/forest-cover/2025.png", extent: { west: 71.728275, south: 21.452979, east: 71.822287, north: 21.511565 } },
    },
    visibility: "public",
  },
  {
    id: "green-cover",
    name: "Green Cover",
    group: "Obj 1 — Forest Cover",
    kind: "raster",
    status: "available",
    rasterYears: {
      1980: { path: "gis/raster/green-cover/1980.png", extent: { west: 71.72702, south: 21.452038, east: 71.82322, north: 21.512114 } },
      1989: { path: "gis/raster/green-cover/1989.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      1998: { path: "gis/raster/green-cover/1998.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2008: { path: "gis/raster/green-cover/2008.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2018: { path: "gis/raster/green-cover/2018.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2025: { path: "gis/raster/green-cover/2025.png", extent: { west: 71.728275, south: 21.452979, east: 71.822287, north: 21.511565 } },
      2026: { path: "gis/raster/green-cover/2026.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
    },
    visibility: "public",
  },
  {
    id: "vegetation-change",
    name: "Vegetation Change",
    group: "Obj 1 — Forest Cover",
    kind: "raster",
    status: "available",
    // Keyed by the later ("to") year of each from/to pair.
    rasterYears: {
      1989: { path: "gis/raster/vegetation-change/1989.png", compareYear: 1980, extent: { west: 71.727577, south: 21.452491, east: 71.822678, north: 21.511575 } },
      1998: { path: "gis/raster/vegetation-change/1998.png", compareYear: 1989, extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2008: { path: "gis/raster/vegetation-change/2008.png", compareYear: 1998, extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2018: { path: "gis/raster/vegetation-change/2018.png", compareYear: 2008, extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2025: { path: "gis/raster/vegetation-change/2025.png", compareYear: 2018, extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2026: { path: "gis/raster/vegetation-change/2026.png", compareYear: 2025, extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
    },
    visibility: "public",
  },
  {
    id: "fragmentation",
    name: "Fragmentation",
    group: "Obj 1 — Forest Cover",
    kind: "raster",
    status: "available",
    rasterYears: {
      1980: { path: "gis/raster/fragmentation/1980.png", extent: { west: 71.72702, south: 21.452038, east: 71.82322, north: 21.512114 } },
      1989: { path: "gis/raster/fragmentation/1989.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      1998: { path: "gis/raster/fragmentation/1998.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2008: { path: "gis/raster/fragmentation/2008.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2018: { path: "gis/raster/fragmentation/2018.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2025: { path: "gis/raster/fragmentation/2025.png", extent: { west: 71.728275, south: 21.452979, east: 71.822286, north: 21.511473 } },
      2026: { path: "gis/raster/fragmentation/2026.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
    },
    visibility: "public",
  },

  // --- Obj 2-4: classification --------------------------------------------
  {
    id: "forest-type",
    name: "Forest Type",
    group: "Obj 2 — Forest Type",
    kind: "raster",
    status: "pending",
    visibility: "public",
  },
  {
    id: "ecological-degradation",
    name: "Ecological Degradation",
    group: "Obj 3 — Ecological Degradation",
    kind: "raster",
    status: "pending",
    visibility: "public",
  },
  {
    id: "lulc",
    name: "LULC",
    group: "Obj 4 — LULC",
    kind: "raster",
    status: "available",
    rasterYears: {
      1980: { path: "gis/raster/lulc/1980.png", extent: { west: 71.72702, south: 21.452038, east: 71.82322, north: 21.512114 } },
      1989: { path: "gis/raster/lulc/1989.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      1998: { path: "gis/raster/lulc/1998.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2008: { path: "gis/raster/lulc/2008.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2018: { path: "gis/raster/lulc/2018.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
      2025: { path: "gis/raster/lulc/2025.png", extent: { west: 71.728275, south: 21.452979, east: 71.822287, north: 21.511565 } },
      2026: { path: "gis/raster/lulc/2026.png", extent: { west: 71.727566, south: 21.452156, east: 71.82277, north: 21.511847 } },
    },
    visibility: "public",
  },

  // --- Obj 5: Forest boundary/status ---------------------------------------
  {
    id: "forest-boundary",
    name: "Forest Boundary / Forest Status",
    group: "Obj 5 — Forest Status",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/forest-boundary.geojson",
    geometryKind: "polygon",
    attributeFields: ["F_TYPE"],
    visibility: "public",
  },

  // --- Obj 6: TOF -----------------------------------------------------------
  {
    id: "tof",
    name: "TOF",
    group: "Obj 6 — Trees Outside Forest",
    kind: "raster",
    status: "pending",
    visibility: "public",
  },

  // --- Obj 7: Cadastral ------------------------------------------------------
  {
    id: "survey-number",
    name: "Survey Number / Cadastral Map",
    group: "Obj 7 — Cadastral",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/survey-number.geojson",
    geometryKind: "polygon",
    attributeFields: ["Plot_No", "Village"],
    // Land-record data — authenticated users only.
    visibility: AUTHENTICATED,
  },

  // --- Obj 8: Growing stock / trees -------------------------------------
  {
    id: "growing-stock",
    name: "Growing Stock",
    group: "Obj 8 — Growing Stock",
    kind: "raster",
    status: "pending",
    visibility: "public",
  },
  {
    id: "tree-count",
    name: "Tree Count",
    group: "Obj 8 — Growing Stock",
    kind: "pending",
    status: "pending",
    visibility: "public",
  },
  {
    id: "tree-height",
    name: "Tree Height",
    group: "Obj 8 — Growing Stock",
    kind: "raster",
    status: "pending",
    visibility: "public",
  },

  // --- Obj 9: Species ---------------------------------------------------
  {
    id: "tree-species",
    name: "Tree Species",
    group: "Obj 9 — Tree Species",
    kind: "pending",
    status: "pending",
    visibility: "public",
  },

  // --- Obj 10: Hydrology --------------------------------------------------
  {
    id: "streams",
    name: "Streams",
    group: "Obj 10 — Hydrology",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/streams.geojson",
    geometryKind: "line",
    attributeFields: ["strmOrder", "Length"],
    visibility: "public",
  },
  {
    id: "catchments",
    name: "Catchments / Watershed",
    group: "Obj 10 — Hydrology",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/catchments.geojson",
    geometryKind: "polygon",
    attributeFields: ["Area", "Subbasin"],
    visibility: "public",
  },
  {
    id: "flood",
    name: "Flood",
    group: "Obj 10 — Hydrology",
    kind: "pending",
    status: "pending",
    visibility: "public",
  },

  // --- Obj 13: Wildlife -----------------------------------------------------
  {
    id: "habitat-suitability",
    name: "Habitat Suitability",
    group: "Obj 13 — Wildlife",
    kind: "raster",
    status: "pending",
    visibility: "public",
  },
  {
    id: "corridor-mapping",
    name: "Corridor Mapping / Wildlife Corridor",
    group: "Obj 13 — Wildlife",
    kind: "pending",
    status: "pending",
    visibility: "public",
  },

  // --- Obj 14: Carbon -------------------------------------------------------
  {
    id: "agb",
    name: "AGB",
    group: "Obj 14 — Carbon",
    kind: "raster",
    status: "pending",
    visibility: "public",
  },
  {
    id: "carbon-stock",
    name: "Carbon Stock",
    group: "Obj 14 — Carbon",
    kind: "raster",
    status: "pending",
    visibility: "public",
  },

  // --- Admin / reference ------------------------------------------------
  {
    id: "district",
    name: "District",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/district.geojson",
    geometryKind: "polygon",
    attributeFields: ["District"],
    visibility: "public",
  },
  {
    id: "taluka",
    name: "Taluka",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/taluka.geojson",
    geometryKind: "polygon",
    attributeFields: ["Taluka"],
    visibility: "public",
  },
  {
    id: "village",
    name: "Village",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/village.geojson",
    geometryKind: "polygon",
    attributeFields: ["Village"],
    visibility: "public",
  },
  {
    id: "roads",
    name: "Roads",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/roads.geojson",
    geometryKind: "line",
    attributeFields: ["Category", "NAME"],
    visibility: "public",
  },
  {
    id: "railways",
    name: "Railways",
    group: "Admin",
    kind: "pending",
    status: "pending",
    visibility: "public",
  },
  {
    id: "rivers",
    name: "Rivers",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/rivers.geojson",
    geometryKind: "line",
    attributeFields: ["Categories"],
    visibility: "public",
  },
  {
    id: "canals",
    name: "Canals",
    group: "Admin",
    kind: "pending",
    status: "pending",
    visibility: "public",
  },
  {
    id: "forest",
    name: "Forest",
    group: "Admin",
    kind: "pending",
    status: "pending",
    visibility: "public",
  },

  // --- LiDAR ----------------------------------------------------------------
  {
    id: "ortho",
    name: "Ortho (Orthomosaic)",
    group: "LiDAR",
    kind: "raster",
    status: "available",
    isPhotographic: true,
    rasterAsset: {
      path: "gis/raster/ortho/ortho.png",
      extent: { west: 71.726065, south: 21.450188, east: 71.823536, north: 21.512689 },
    },
    // Drone-derived imagery — authenticated users only, per data policy.
    visibility: AUTHENTICATED,
  },
  // Extent and gradient are documented (see Raster/Drone Data/Extent.docx and
  // Legend Color.docx), but no DSM image was actually delivered.
  {
    id: "dsm",
    name: "DSM",
    group: "LiDAR",
    kind: "raster",
    status: "pending",
    visibility: AUTHENTICATED,
  },
  {
    id: "dtm",
    name: "DTM",
    group: "LiDAR",
    kind: "raster",
    status: "available",
    rasterAsset: {
      path: "gis/raster/dtm/dtm.png",
      extent: { west: 71.727678, south: 21.452812, east: 71.823913, north: 21.512044 },
    },
    visibility: AUTHENTICATED,
  },
  {
    id: "chm",
    name: "CHM",
    group: "LiDAR",
    kind: "raster",
    status: "available",
    rasterAsset: {
      path: "gis/raster/chm/chm.png",
      extent: { west: 71.727066, south: 21.452069, east: 71.823365, north: 21.512053 },
    },
    visibility: AUTHENTICATED,
  },
  {
    id: "slope",
    name: "Slope",
    group: "LiDAR",
    kind: "raster",
    status: "available",
    rasterAsset: {
      path: "gis/raster/slope/slope.png",
      extent: { west: 71.727678, south: 21.452812, east: 71.823913, north: 21.512044 },
    },
    visibility: AUTHENTICATED,
  },
  {
    id: "aspect",
    name: "Aspect",
    group: "LiDAR",
    kind: "raster",
    status: "available",
    rasterAsset: {
      path: "gis/raster/aspect/aspect.png",
      extent: { west: 71.727678, south: 21.452812, east: 71.823913, north: 21.512044 },
    },
    visibility: AUTHENTICATED,
  },

  // --- Satellite --------------------------------------------------------
  {
    id: "fcc",
    name: "FCC",
    group: "Satellite",
    kind: "raster",
    status: "available",
    isPhotographic: true,
    rasterYears: {
      1980: { path: "gis/raster/fcc/1980.png", extent: { west: 71.72814, south: 21.451769, east: 71.821924, north: 21.512136 } },
      1989: { path: "gis/raster/fcc/1989.png", extent: { west: 71.728409, south: 21.451769, east: 71.821924, north: 21.512136 } },
      1998: { path: "gis/raster/fcc/1998.png", extent: { west: 71.728409, south: 21.451769, east: 71.821924, north: 21.512136 } },
      2008: { path: "gis/raster/fcc/2008.png", extent: { west: 71.728409, south: 21.451769, east: 71.821924, north: 21.512136 } },
      2018: { path: "gis/raster/fcc/2018.png", extent: { west: 71.728409, south: 21.451769, east: 71.821924, north: 21.512136 } },
      2025: { path: "gis/raster/fcc/2025.png", extent: { west: 71.728409, south: 21.451769, east: 71.821924, north: 21.512136 } },
      2026: { path: "gis/raster/fcc/2026.png", extent: { west: 71.728409, south: 21.451769, east: 71.821924, north: 21.512136 } },
    },
    visibility: "public",
  },

  // --- Admin: analysis grids ----------------------------------------------
  {
    id: "grids",
    name: "Grids",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/grids.geojson",
    geometryKind: "polygon",
    attributeFields: ["GridNum"],
    visibility: AUTHENTICATED,
  },
  {
    id: "zones",
    name: "Zones",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/zones.geojson",
    geometryKind: "polygon",
    attributeFields: ["ZName"],
    visibility: AUTHENTICATED,
  },
  {
    id: "tracks",
    name: "Tracks",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/tracks.geojson",
    geometryKind: "line",
    attributeFields: ["Name"],
    visibility: "public",
  },
  {
    id: "steps",
    name: "Steps",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/steps.geojson",
    geometryKind: "line",
    attributeFields: ["Name"],
    visibility: "public",
  },

  // --- SMC (soil/water conservation structures) --------------------------
  {
    id: "smc-vantalavadi",
    name: "Vantalavadi",
    group: "SMC",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/smc-vantalavadi.geojson",
    geometryKind: "polygon",
    attributeFields: ["Feature"],
    visibility: AUTHENTICATED,
  },
  {
    id: "smc-matipala",
    name: "Matipala",
    group: "SMC",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/smc-matipala.geojson",
    geometryKind: "polygon",
    attributeFields: ["Feature"],
    visibility: AUTHENTICATED,
  },
  {
    id: "smc-checkdam",
    name: "Checkdam",
    group: "SMC",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/smc-checkdam.geojson",
    geometryKind: "polygon",
    attributeFields: ["Feature"],
    visibility: AUTHENTICATED,
  },
  {
    id: "smc-causeway",
    name: "Causeway",
    group: "SMC",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/smc-causeway.geojson",
    geometryKind: "polygon",
    attributeFields: ["Feature"],
    visibility: AUTHENTICATED,
  },
  {
    id: "potential-smc",
    name: "Potential SMC",
    group: "SMC",
    kind: "pending",
    status: "pending",
    visibility: AUTHENTICATED,
  },

  // --- Admin: study area ----------------------------------------------------
  {
    id: "study-area",
    name: "Study Area",
    group: "Admin",
    kind: "vector",
    status: "available",
    assetPath: "gis/vector/study-area.geojson",
    geometryKind: "polygon",
    visibility: "public",
  },
];

// numericId is assigned by declaration order above — stable across roles and
// across a session, since REGISTRY_DEFINITIONS never reorders at runtime.
export const GIS_REGISTRY: LayerRegistryEntry[] = REGISTRY_DEFINITIONS.map((def, i) => ({
  ...def,
  numericId: i + 1,
}));

export function registryEntry(id: string): LayerRegistryEntry | undefined {
  return GIS_REGISTRY.find((entry) => entry.id === id);
}

export function isVisibleToRole(entry: LayerRegistryEntry, role: Role | null): boolean {
  if (entry.visibility === "public") return true;
  return role !== null && entry.visibility.includes(role);
}

// Named distinctly from lib/layers-mock.ts's layersForRole(), which returns
// GeoJSON features for the map — this returns registry rows for the layer
// panel (including pending ones, which never appear in map data).
export function registryForRole(role: Role | null): LayerRegistryEntry[] {
  return GIS_REGISTRY.filter((entry) => isVisibleToRole(entry, role));
}
