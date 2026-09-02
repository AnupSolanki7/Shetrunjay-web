"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Popup,
  type FilterSpecification,
  type GeoJSONSource,
  type IControl,
  type ImageSource,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { boundsOfFeature } from "@/lib/geo";
import { layerColor } from "@/lib/layer-style";
import { MapControls } from "@/components/MapControls";
import type { LayerFeature, LayerCollection } from "@/lib/layers-api";
import type { RasterExtent } from "@/lib/gis-registry";

const POLYGON_TYPES = new Set(["Polygon", "MultiPolygon"]);
const LINE_TYPES = new Set(["LineString", "MultiLineString"]);
const POINT_TYPES = new Set(["Point", "MultiPoint"]);

const BACKGROUND_LIGHT = "#EDEDE8";
const BACKGROUND_DARK = "#0E100F";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export interface ThemeOverlay {
  geometry: GeoJSON.Geometry;
  color: string;
  visible: boolean;
}

// A raster registry layer the user has toggled on, resolved to whichever
// year's asset is currently selected (lib/gis-registry.ts's rasterYears /
// rasterAsset).
export interface ActiveRasterLayer {
  id: string;
  url: string;
  extent: RasterExtent;
  opacity: number;
}

function rasterSourceId(id: string): string {
  return `raster-${id}`;
}

// MapLibre image sources take corners clockwise from the top-left.
function cornersFromExtent(extent: RasterExtent): [[number, number], [number, number], [number, number], [number, number]] {
  const { west, south, east, north } = extent;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

const ATTRIBUTION_LIGHT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ATTRIBUTION_DARK = `${ATTRIBUTION_LIGHT} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

// MapLibre's built-in attribution control is a native <details>/<summary>
// element that opens itself on first paint no matter what options it's
// given — there's no way to start it closed short of fighting its internal
// state after the fact, which breaks its own click handling. A small custom
// control using the same CSS classes gets the identical look with a toggle
// we fully own.
class CompactAttribution implements IControl {
  private container: HTMLDivElement;
  private inner: HTMLDivElement;
  private open = false;

  constructor(html: string) {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "maplibregl-ctrl-attrib-button";
    button.setAttribute("aria-label", "Toggle attribution");
    button.addEventListener("click", () => {
      this.open = !this.open;
      this.container.classList.toggle("maplibregl-compact-show", this.open);
    });

    this.inner = document.createElement("div");
    this.inner.className = "maplibregl-ctrl-attrib-inner";
    this.inner.innerHTML = html;

    this.container.append(button, this.inner);
  }

  setHTML(html: string) {
    this.inner.innerHTML = html;
  }

  onAdd(): HTMLElement {
    return this.container;
  }

  onRemove(): void {
    this.container.remove();
  }
}

// Raster basemap: OpenStreetMap tiles for light, CARTO Dark Matter for dark
// — an actual dark map style, not a CSS/paint colour trick over one raster
// source (hue-rotate over light tiles reads as grey, not dark).
function mapStyle() {
  const dark = isDark();
  return {
    version: 8 as const,
    sources: {
      "basemap-light": {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: ATTRIBUTION_LIGHT,
      },
      "basemap-dark": {
        type: "raster" as const,
        tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: ATTRIBUTION_DARK,
      },
    },
    layers: [
      {
        id: "background",
        type: "background" as const,
        paint: { "background-color": dark ? BACKGROUND_DARK : BACKGROUND_LIGHT },
      },
      {
        id: "basemap-light",
        type: "raster" as const,
        source: "basemap-light",
        layout: { visibility: (dark ? "none" : "visible") as "none" | "visible" },
      },
      {
        id: "basemap-dark",
        type: "raster" as const,
        source: "basemap-dark",
        layout: { visibility: (dark ? "visible" : "none") as "none" | "visible" },
      },
    ],
  };
}

function applyBasemapTheme(map: MapLibreMap, dark: boolean, attribution: CompactAttribution) {
  const bg = dark ? BACKGROUND_DARK : BACKGROUND_LIGHT;
  map.setPaintProperty("background", "background-color", bg);
  map.setLayoutProperty("basemap-light", "visibility", dark ? "none" : "visible");
  map.setLayoutProperty("basemap-dark", "visibility", dark ? "visible" : "none");
  if (map.getLayer("lines-casing")) {
    map.setPaintProperty("lines-casing", "line-color", bg);
  }
  attribution.setHTML(dark ? ATTRIBUTION_DARK : ATTRIBUTION_LIGHT);
}

// MapLibre's GeoJSON source pipeline only carries scalar property values
// through to click/query results — nested objects don't survive it — so
// attrs (a Record) gets flattened to individual attr_<field> scalars here,
// just for what the map source needs. The React-facing LayerFeature.attrs
// shape (used by panels, not the map) stays a plain object.
function flattenAttrs(attrs: Record<string, string | number | null>): Record<string, string | number> {
  const flat: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null) flat[`attr_${key}`] = value;
  }
  return flat;
}

function byGeometryType(
  data: LayerCollection,
  types: Set<string>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.features
      .filter((f) => types.has(f.geometry.type))
      // colour rides along per feature so paint reads ["get", "color"] —
      // no layer name/id branch in the paint expression itself.
      .map((f) => ({
        ...f,
        properties: {
          id: f.properties.id,
          name: f.properties.name,
          color: layerColor(f.properties.id),
          ...flattenAttrs(f.properties.attrs),
        },
      })),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Click popup: layer name plus whatever attribute fields the registry
// declared for that layer (lib/gis-registry.ts's attributeFields), read back
// off the attr_<field> scalars byGeometryType() flattened onto the source.
function attachPopups(map: MapLibreMap) {
  const layerIds = ["polygons-fill", "lines", "points"];
  const popup = new Popup({ closeButton: true, closeOnClick: true, maxWidth: "260px" });

  map.on("click", layerIds, (e) => {
    const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
    if (!feature) return;
    const props = (feature.properties ?? {}) as Record<string, string | number>;

    const rows = Object.entries(props)
      .filter(([key]) => key.startsWith("attr_"))
      .map(
        ([key, value]) =>
          `<div class="flex justify-between gap-3"><span class="opacity-60">${escapeHtml(key.slice(5))}</span><span>${escapeHtml(String(value))}</span></div>`,
      )
      .join("");

    const name = typeof props.name === "string" ? escapeHtml(props.name) : "";
    const html = `<div class="text-sm font-medium">${name}</div>${
      rows ? `<div class="mt-1 flex flex-col gap-0.5 text-xs">${rows}</div>` : ""
    }`;

    popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  for (const id of layerIds) {
    map.on("mouseenter", id, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", id, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

// Raster theme overlays (LULC, Green Cover, Vegetation Change, drone
// products, ...) — one MapLibre image source + raster layer per active
// layer, inserted above the polygon fills (Catchments' many nested/
// overlapping sub-basins stack their 0.25 opacity to near-opaque and would
// otherwise hide any raster underneath) but below the line/point layers, so
// roads/streams/boundaries stay legible as a reference on top of the
// imagery. `applied` tracks what's already on the map (keyed by registry
// id) so an unrelated re-render doesn't reload every image — only a
// genuinely new url/extent does.
function syncRasterLayers(
  map: MapLibreMap,
  active: ActiveRasterLayer[],
  applied: Map<string, { url: string; extent: RasterExtent }>,
) {
  const activeIds = new Set(active.map((r) => r.id));

  for (const id of applied.keys()) {
    if (activeIds.has(id)) continue;
    const sourceId = rasterSourceId(id);
    if (map.getLayer(sourceId)) map.removeLayer(sourceId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    applied.delete(id);
  }

  for (const layer of active) {
    const sourceId = rasterSourceId(layer.id);
    const prev = applied.get(layer.id);
    const coordinates = cornersFromExtent(layer.extent);

    if (!prev) {
      map.addSource(sourceId, { type: "image", url: layer.url, coordinates });
      map.addLayer(
        { id: sourceId, type: "raster", source: sourceId, paint: { "raster-opacity": layer.opacity } },
        map.getLayer("lines-casing") ? "lines-casing" : undefined,
      );
    } else if (prev.url !== layer.url || JSON.stringify(prev.extent) !== JSON.stringify(layer.extent)) {
      const source = map.getSource<ImageSource>(sourceId);
      source?.updateImage({ url: layer.url, coordinates });
    }
    if (map.getLayer(sourceId)) map.setPaintProperty(sourceId, "raster-opacity", layer.opacity);
    applied.set(layer.id, { url: layer.url, extent: layer.extent });
  }
}

function addLayers(
  map: MapLibreMap,
  polygons: GeoJSON.FeatureCollection,
  lines: GeoJSON.FeatureCollection,
  points: GeoJSON.FeatureCollection,
) {
  map.addSource("polygons", { type: "geojson", data: polygons });
  map.addSource("lines", { type: "geojson", data: lines });
  map.addSource("points", { type: "geojson", data: points });

  map.addLayer({
    id: "polygons-fill",
    type: "fill",
    source: "polygons",
    paint: { "fill-color": ["get", "color"], "fill-opacity": 0.25 },
  });
  map.addLayer({
    id: "polygons-outline",
    type: "line",
    source: "polygons",
    paint: { "line-color": ["get", "color"], "line-width": 2 },
  });

  // casing under stroke: a wider surface-colour line beneath the layer
  // colour keeps every line legible on both themes (design system §2).
  map.addLayer({
    id: "lines-casing",
    type: "line",
    source: "lines",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": isDark() ? BACKGROUND_DARK : BACKGROUND_LIGHT, "line-width": 5 },
  });
  map.addLayer({
    id: "lines",
    type: "line",
    source: "lines",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 3 },
  });

  map.addLayer({
    id: "points",
    type: "circle",
    source: "points",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": 6,
      "circle-stroke-width": 2,
      "circle-stroke-color": isDark() ? BACKGROUND_DARK : BACKGROUND_LIGHT,
    },
  });

  // Theme overlay: a stand-in for satellite/drone imagery a theme's filters
  // would show, using whatever geometry the caller hands it (e.g. the hill
  // boundary) tinted per-selection. Hidden until a theme sets it visible.
  map.addSource("theme-overlay", { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: "theme-overlay-fill",
    type: "fill",
    source: "theme-overlay",
    layout: { visibility: "none" },
    paint: { "fill-color": ["get", "color"], "fill-opacity": 0.45 },
  });
  map.addLayer({
    id: "theme-overlay-outline",
    type: "line",
    source: "theme-overlay",
    layout: { visibility: "none" },
    paint: { "line-color": ["get", "color"], "line-width": 2, "line-dasharray": [2, 2] },
  });
}

function render(map: MapLibreMap, data: LayerCollection, fitOnce: { done: boolean }) {
  const polygons = byGeometryType(data, POLYGON_TYPES);
  const lines = byGeometryType(data, LINE_TYPES);
  const points = byGeometryType(data, POINT_TYPES);

  const polygonsSource = map.getSource<GeoJSONSource>("polygons");
  const linesSource = map.getSource<GeoJSONSource>("lines");
  const pointsSource = map.getSource<GeoJSONSource>("points");

  if (polygonsSource && linesSource && pointsSource) {
    polygonsSource.setData(polygons);
    linesSource.setData(lines);
    pointsSource.setData(points);
  } else {
    addLayers(map, polygons, lines, points);
  }

  if (!fitOnce.done) {
    const bounds = data.features.map(boundsOfFeature).find(Boolean);
    if (bounds) {
      map.fitBounds(bounds, { padding: 40, animate: false });
      fitOnce.done = true;
    }
  }
}

export default function Map({
  data,
  visibility,
  onReady,
  onToggleLayers,
  themeOverlay,
  rasterLayers,
}: {
  data: LayerCollection;
  visibility: Record<number, boolean>;
  onReady?: (map: MapLibreMap) => void;
  onToggleLayers?: () => void;
  themeOverlay?: ThemeOverlay | null;
  rasterLayers?: ActiveRasterLayer[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dataRef = useRef(data);
  const fitOnceRef = useRef({ done: false });
  const rasterLayersRef = useRef(rasterLayers);
  // globalThis.Map, not the local Map component this function is itself named after.
  const appliedRasterRef = useRef(new globalThis.Map<string, { url: string; extent: RasterExtent }>());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    rasterLayersRef.current = rasterLayers;
  }, [rasterLayers]);

  // map lifecycle: create once, tear down on unmount
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle(),
      center: [71.7800412, 21.4718707], // Shetrunjay Hill Range, near Palitana
      zoom: 11,
      attributionControl: false,
    });
    mapRef.current = map;

    const attribution = new CompactAttribution(isDark() ? ATTRIBUTION_DARK : ATTRIBUTION_LIGHT);
    map.addControl(attribution, "bottom-right");

    map.on("load", () => {
      render(map, dataRef.current, fitOnceRef.current);
      attachPopups(map);
      syncRasterLayers(map, rasterLayersRef.current ?? [], appliedRasterRef.current);
      onReady?.(map);
    });

    const observer = new MutationObserver(() => {
      if (!map.isStyleLoaded()) return;
      applyBasemapTheme(map, isDark(), attribution);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // data updates: push into the already-running map without recreating it
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) render(map, data, fitOnceRef.current);
  }, [data]);

  // theme overlay: swap the mock satellite/drone tint in place, no refit
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource<GeoJSONSource>("theme-overlay");
    if (!source) return;

    const visible = Boolean(themeOverlay?.visible);
    source.setData(
      themeOverlay
        ? {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: { color: themeOverlay.color }, geometry: themeOverlay.geometry },
            ],
          }
        : EMPTY_FC,
    );
    for (const layerId of ["theme-overlay-fill", "theme-overlay-outline"]) {
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    }
  }, [themeOverlay]);

  // raster overlays: add/remove/swap image sources as layers are toggled or
  // their selected year changes, without touching the vector sources.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncRasterLayers(map, rasterLayers ?? [], appliedRasterRef.current);
  }, [rasterLayers]);

  // visibility toggles: filter, never re-fetch or refit
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const hiddenIds = Object.entries(visibility)
      .filter(([, visible]) => !visible)
      .map(([id]) => Number(id));
    const filter: FilterSpecification | null = hiddenIds.length
      ? ["!", ["in", ["get", "id"], ["literal", hiddenIds]]]
      : null;
    for (const layerId of ["polygons-fill", "polygons-outline", "lines-casing", "lines", "points"]) {
      if (map.getLayer(layerId)) map.setFilter(layerId, filter);
    }
  }, [visibility]);

  return (
    <div className="absolute inset-0">
      {/* MapLibre stamps its own position:relative onto this node, which
          would override an absolute/inset sizing class in the cascade —
          percentage sizing sidesteps that fight. */}
      <div ref={containerRef} className="size-full" />
      <MapControls
        mapRef={mapRef}
        fitBounds={() => {
          const map = mapRef.current;
          const bounds = dataRef.current.features.map(boundsOfFeature).find(Boolean);
          if (map && bounds) map.fitBounds(bounds, { padding: 40 });
        }}
        onToggleLayers={onToggleLayers}
      />
    </div>
  );
}

export type { LayerFeature };
