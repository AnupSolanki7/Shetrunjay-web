"use client";

import { useState } from "react";
import { ListTree, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayerSwatch, type SwatchGeometryKind } from "@/components/LayerSwatch";
import { legendFor } from "@/lib/legend-config";
import type { LayerFeature } from "@/lib/layers-api";

const POINT_TYPES = new Set(["Point", "MultiPoint"]);
const LINE_TYPES = new Set(["LineString", "MultiLineString"]);

function geometryKindOf(feature: LayerFeature): SwatchGeometryKind {
  if (POINT_TYPES.has(feature.geometry.type)) return "point";
  if (LINE_TYPES.has(feature.geometry.type)) return "line";
  return "polygon";
}

// Many features can share one layer (e.g. 2,000+ survey-number parcels) —
// the legend lists one row per layer, not per feature.
function uniqueLayers(features: LayerFeature[]): LayerFeature[] {
  const seen = new Map<number, LayerFeature>();
  for (const feature of features) {
    if (!seen.has(feature.properties.id)) seen.set(feature.properties.id, feature);
  }
  return [...seen.values()];
}

// Above this many classes a single column gets too tall for the card.
const TWO_COLUMN_THRESHOLD = 8;

function isLong(legend: { classes: unknown[] }): boolean {
  return legend.classes.length > TWO_COLUMN_THRESHOLD;
}

export interface LegendRasterLayer {
  id: string;
  name: string;
  isPhotographic?: boolean;
}

export function LegendCard({
  layers,
  rasterLayers = [],
  className,
}: {
  layers: LayerFeature[];
  rasterLayers?: LegendRasterLayer[];
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const rows = uniqueLayers(layers);

  if (rows.length === 0 && rasterLayers.length === 0) return null;

  return (
    <Card className={className} size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTree className="size-4 text-muted-foreground" strokeWidth={1.75} />
          Legend
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "Expand legend" : "Collapse legend"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <ChevronDown className={cn("transition-transform", collapsed && "-rotate-90")} />
          </Button>
        </CardAction>
      </CardHeader>
      {/* No max-height/scroll on the content: every entry stays visible, since
          a scrollbar inside the legend is easy to miss. The caller caps the
          card against the map area as an off-screen safety. */}
      {!collapsed && (
        <CardContent className="flex flex-col gap-3">
          {rows.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {rows.map((feature) => (
                <div key={feature.properties.id} className="flex items-center gap-2 text-sm">
                  <LayerSwatch color={feature.properties.color} geometryKind={geometryKindOf(feature)} />
                  <span>{feature.properties.name}</span>
                </div>
              ))}
            </div>
          )}

          {rasterLayers.map((raster) => {
            const legend = legendFor(raster.id);
            return (
              <div key={raster.id} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{raster.name}</span>
                {raster.isPhotographic ? (
                  <span className="text-xs text-muted-foreground/70 italic">Photographic image — no class legend</span>
                ) : (
                  legend && (
                    <div className="flex flex-col gap-1">
                      {/* Long class lists (e.g. Vegetation Change's 25-way
                          transition matrix) go two-up with their compact
                          labels, so the legend still fits without scrolling. */}
                      <div className={cn("gap-x-2 gap-y-1", isLong(legend) ? "grid grid-cols-2" : "flex flex-col")}>
                        {legend.classes.map((cls) => (
                          <div key={cls.value} className="flex items-center gap-1.5 text-xs">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: cls.color }}
                              aria-hidden
                            />
                            <span className="truncate" title={cls.label}>
                              {isLong(legend) ? (cls.shortLabel ?? cls.label) : cls.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      {legend.note && (
                        <span className="text-[10px] text-muted-foreground/70 italic">{legend.note}</span>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
