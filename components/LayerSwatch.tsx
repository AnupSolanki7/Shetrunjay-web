import { layerColor } from "@/lib/layer-style";

export type SwatchGeometryKind = "point" | "line" | "polygon";

export function LayerSwatch({ id, geometryKind }: { id: number; geometryKind: SwatchGeometryKind }) {
  const color = layerColor(id);

  if (geometryKind === "point") {
    return (
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }

  return (
    <span
      className="h-0.5 w-4 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}
