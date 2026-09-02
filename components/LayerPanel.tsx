"use client";

import { useState } from "react";
import { MoreVertical, RotateCcw, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayerSwatch } from "@/components/LayerSwatch";
import { cn } from "@/lib/utils";
import type { LayerRegistryEntry } from "@/lib/gis-registry";

function groupLayers(layers: LayerRegistryEntry[]): [string, LayerRegistryEntry[]][] {
  const byGroup = new Map<string, LayerRegistryEntry[]>();
  for (const layer of layers) {
    const group = byGroup.get(layer.group) ?? [];
    group.push(layer);
    byGroup.set(layer.group, group);
  }
  return [...byGroup.entries()];
}

export function LayerPanel({
  layers,
  loading,
  error,
  visibility,
  onToggle,
  rasterYear,
  onRasterYearChange,
  onRetry,
  bare = false,
  className,
}: {
  layers: LayerRegistryEntry[] | null;
  loading: boolean;
  error: boolean;
  visibility: Record<number, boolean>;
  onToggle: (id: number, currentlyVisible: boolean) => void;
  rasterYear: Record<string, number>;
  onRasterYearChange: (id: string, year: number) => void;
  onRetry: () => void;
  bare?: boolean;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const rows = (
    <>
      {loading && (
        <div className="flex flex-col gap-2 py-1" aria-label="Loading layers">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-start gap-2 py-2">
          <p className="text-sm text-destructive">Could not load layers.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && layers?.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">
          No layers are available for your role.
        </p>
      )}

      {!loading &&
        !error &&
        groupLayers(layers ?? []).map(([group, groupLayers]) => (
          <div key={group} className="flex flex-col gap-0.5">
            <span className="px-1 pt-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {group}
            </span>
            {groupLayers.map((layer) => {
              const pending = layer.status === "pending";
              // Rasters default off — several can cover the whole hill at
              // once, so starting all of them on would just stack opaque
              // images. Vector layers keep the original default-on behavior.
              const visible = visibility[layer.numericId] ?? layer.kind !== "raster";
              const years = layer.rasterYears ? Object.keys(layer.rasterYears).map(Number).sort((a, b) => a - b) : null;
              const selectedYear = years ? (rasterYear[layer.id] ?? years[years.length - 1]) : null;

              const row = (
                <div
                  key={layer.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-1 py-1.5",
                    pending ? "cursor-not-allowed opacity-50" : "hover:bg-muted",
                  )}
                >
                  {pending ? (
                    <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
                  ) : (
                    <LayerSwatch id={layer.numericId} geometryKind={layer.geometryKind ?? "polygon"} />
                  )}
                  <span className="flex-1 truncate text-sm">{layer.name}</span>
                  {pending ? (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Pending
                    </Badge>
                  ) : (
                    <>
                      {years && selectedYear !== null && (
                        <Select
                          value={String(selectedYear)}
                          onValueChange={(v) => onRasterYearChange(layer.id, Number(v))}
                        >
                          <SelectTrigger size="sm" className="h-6 w-18 text-xs" aria-label={`${layer.name} year`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map((y) => (
                              <SelectItem key={y} value={String(y)}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Switch
                        size="sm"
                        checked={visible}
                        onCheckedChange={() => onToggle(layer.numericId, visible)}
                        aria-label={`Toggle ${layer.name} layer`}
                      />
                    </>
                  )}
                </div>
              );

              if (!pending) return row;

              return (
                <Tooltip key={layer.id}>
                  <TooltipTrigger asChild>{row}</TooltipTrigger>
                  <TooltipContent>Data not yet available for this layer</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
    </>
  );

  if (bare) {
    return (
      <div className={cn("flex shrink-0 flex-col", className)}>
        <div className="flex items-center justify-between p-4 pb-2">
          <span className="font-heading text-base font-medium">Layers</span>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Layer panel options">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onRetry}>
                  <RotateCcw />
                  Refresh
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={collapsed ? "Expand layers panel" : "Collapse layers panel"}
              onClick={() => setCollapsed((c) => !c)}
            >
              <ChevronDown className={cn("transition-transform", collapsed && "-rotate-90")} />
            </Button>
          </div>
        </div>
        {!collapsed && (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto scrollbar-thin px-4 pb-4">{rows}</div>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Layers</CardTitle>
        <CardAction className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Layer panel options"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onRetry}>
                <RotateCcw />
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "Expand layers panel" : "Collapse layers panel"}
            onClick={() => setCollapsed((c) => !c)}
          >
            <ChevronDown className={cn("transition-transform", collapsed && "-rotate-90")} />
          </Button>
        </CardAction>
      </CardHeader>
      {!collapsed && (
        <CardContent className="flex max-h-80 flex-col gap-1 overflow-y-auto scrollbar-thin">{rows}</CardContent>
      )}
    </Card>
  );
}
