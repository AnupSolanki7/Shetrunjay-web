// Illustrative zonal statistics for the Statistics panel.
//
// lib/gis-registry.ts's header notes that the client's spec sheet marks nine
// layers as "Statistics" layers (Forest Cover, Density, Vegetation Change,
// Forest Type, Ecological Degradation, LULC, TOF, Growing Stock, Habitat
// Suitability) — meant to surface per-class zonal numbers rather than just an
// attribute popup. No zonal-statistics data has been delivered, so the
// class-share numbers below are SYNTHETIC FILLER, in the same spirit as the
// forest-cover placeholders PROJECT.md describes: deterministic per
// (layer, year) so switching the year visibly changes the panel, but not a
// measurement of anything. Do not "fix" them to look more realistic — replace
// the whole module once real zonal stats arrive.
//
// Two things here are NOT filler:
//   - STUDY_AREA_HA, the surveyed hill area from PalitanaStudyArea.geojson.
//   - Vector feature counts, which the panel derives from the actually loaded
//     GeoJSON rather than from this module.

import { legendFor, type LegendClass } from "@/lib/legend-config";
import type { LayerRegistryEntry } from "@/lib/gis-registry";

/** Real surveyed area of the Shetrunjay study area, in hectares. */
export const STUDY_AREA_HA = 3396;

export interface ClassStat {
  value: LegendClass["value"];
  label: string;
  color: string;
  areaHa: number;
  percent: number;
}

export interface TrendPoint {
  year: number;
  percent: number;
}

export interface RasterLayerStats {
  layerId: string;
  name: string;
  year: number | null;
  classes: ClassStat[];
  /** Present for multi-year themes — one tracked class's share over time. */
  trend?: { className: string; color: string; points: TrendPoint[] };
}

// Which legend class a theme's trend line tracks — the class the theme is
// actually "about", rather than whichever happens to be declared first.
const TREND_CLASS_INDEX: Record<string, number> = {
  "forest-cover": 0, // Very Dense Forest
  "green-cover": 1, // Forest (class 0 is Non-Forest)
  lulc: 2, // Dense Vegetation
};

// FNV-1a — any stable string→number hash works; this one is short and has no
// dependencies. Used only to make the filler reproducible, never for security.
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unitRandom(seed: string): number {
  return hash(seed) / 4294967296;
}

// Weights are floored at 0.25 so no class collapses to a rounding-zero sliver
// that would render as an invisible bar segment.
function classShares(layerId: string, year: number | null, count: number): number[] {
  const weights = Array.from({ length: count }, (_, i) =>
    0.25 + unitRandom(`${layerId}|${year ?? "single"}|${i}`),
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => (w / total) * 100);
}

function yearsOf(entry: LayerRegistryEntry): number[] {
  return entry.rasterYears
    ? Object.keys(entry.rasterYears).map(Number).sort((a, b) => a - b)
    : [];
}

/**
 * Per-class breakdown for one raster theme, for the year currently selected.
 * Returns null for layers with no class legend — photographic rasters (Ortho,
 * FCC) have no discrete classes to count.
 */
export function rasterStats(
  entry: LayerRegistryEntry,
  year: number | null,
): RasterLayerStats | null {
  if (entry.isPhotographic) return null;
  const legend = legendFor(entry.id);
  if (!legend || legend.classes.length === 0) return null;

  const shares = classShares(entry.id, year, legend.classes.length);
  const classes: ClassStat[] = legend.classes.map((cls, i) => ({
    value: cls.value,
    label: cls.shortLabel ?? cls.label,
    color: cls.color,
    percent: shares[i],
    areaHa: (shares[i] / 100) * STUDY_AREA_HA,
  }));

  const years = yearsOf(entry);
  const trackedIndex = TREND_CLASS_INDEX[entry.id] ?? 0;
  const tracked = legend.classes[trackedIndex];
  const trend =
    years.length > 1 && tracked
      ? {
          className: tracked.shortLabel ?? tracked.label,
          color: tracked.color,
          points: years.map((y) => ({
            year: y,
            percent: classShares(entry.id, y, legend.classes.length)[trackedIndex],
          })),
        }
      : undefined;

  return { layerId: entry.id, name: entry.name, year, classes, trend };
}
