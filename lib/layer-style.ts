// Cycling palette from the design system's GIS layer colour table (DESIGN.md §2).
// Indexed by a layer's stable numeric id, never its name — adding a layer means
// one more colour in rotation, not a per-name branch.
const LAYER_PALETTE = [
  "#2D7D46",
  "#5AA469",
  "#D18B2A",
  "#4C8ED9",
  "#C56E54",
  "#9B6ED8",
  "#356AE6",
  "#D64545",
];

export function layerColor(id: number): string {
  return LAYER_PALETTE[((id % LAYER_PALETTE.length) + LAYER_PALETTE.length) % LAYER_PALETTE.length];
}

// Registry-declared colour wins; the rotating palette is the fallback for
// entries without one (raster themes, which carry a class legend instead).
export function colorForLayer(entry: { numericId: number; color?: string }): string {
  return entry.color ?? layerColor(entry.numericId);
}
