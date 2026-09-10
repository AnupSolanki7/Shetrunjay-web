"use client";

import { useEffect, useRef, useState } from "react";
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
import { MapControls } from "@/components/MapControls";
import type { LayerFeature, LayerCollection } from "@/lib/layers-api";
import type { RasterExtent } from "@/lib/gis-registry";

const POLYGON_TYPES = new Set(["Polygon", "MultiPolygon"]);
const LINE_TYPES = new Set(["LineString", "MultiLineString"]);
const POINT_TYPES = new Set(["Point", "MultiPoint"]);

const BACKGROUND_LIGHT = "#EDEDE8";
const BACKGROUND_DARK = "#0E100F";

// Stroke widths. A flow overlay MUST be exactly as wide as the base layer it
// animates over: narrower leaves a sliver of layer colour down each side of
// every gap, wider paints over the neighbouring geometry. They were five
// loose numbers held together by a comment; as constants the pairing is
// structural, so thinning a line cannot silently break its dashes.
const LINE_WIDTH = 1;
const LINE_CASING_WIDTH = 2;
const OUTLINE_WIDTH = 0.75;

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
// CARTO's free dark_all tiles now watermark "API KEY REQUIRED" on
// production traffic (still HTTP 200 — the watermark is baked into the
// pixels), so the dark basemap uses Esri's World Dark Gray Canvas instead —
// no signup, no key, same "real dark style" property.
const ATTRIBUTION_DARK = `${ATTRIBUTION_LIGHT} &copy; Esri, HERE, Garmin`;

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function surfaceColor(): string {
  return isDark() ? BACKGROUND_DARK : BACKGROUND_LIGHT;
}

// Marching-ants dash frames for the Base Layers flow animation. line-dasharray
// takes no expression, so it can't vary per feature and can't be tweened —
// the only way to animate it is to swap the whole array each frame, which is
// why this is a hand-rolled loop rather than a MapLibre transition.
//
// The sequence is the standard 14-frame one: the dash grows from the start of
// the pattern to its end, then the gap does the same, which lands back on the
// opening frame — so it cycles forever with no visible seam.
const DASH_SEQUENCE: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

/** ms per frame — 14 frames, so the loop takes a shade under a second. */
const DASH_STEP_MS = 65;

const FLOW_LAYER_IDS = ["polygons-flow", "lines-flow"];

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
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
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: ATTRIBUTION_DARK,
      },
      // Esri splits the dark canvas into a base layer and a separate labels
      // layer — the CARTO tiles this replaces had labels baked in, so this
      // is drawn on top of basemap-dark to match.
      "basemap-dark-labels": {
        type: "raster" as const,
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
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
      {
        id: "basemap-dark-labels",
        type: "raster" as const,
        source: "basemap-dark-labels",
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
  map.setLayoutProperty("basemap-dark-labels", "visibility", dark ? "visible" : "none");
  if (map.getLayer("lines-casing")) {
    map.setPaintProperty("lines-casing", "line-color", bg);
  }
  // The flow dashes are surface-coloured too — they read as gaps in the line
  // beneath them, which only works while they match the map background.
  for (const layerId of FLOW_LAYER_IDS) {
    if (map.getLayer(layerId)) map.setPaintProperty(layerId, "line-color", bg);
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

function byGeometryType(features: LayerFeature[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features
      // colour rides along per feature so paint reads ["get", "color"] —
      // no layer name/id branch in the paint expression itself.
      .map((f) => ({
        ...f,
        properties: {
          id: f.properties.id,
          name: f.properties.name,
          color: f.properties.color,
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
function attachPopups(map: MapLibreMap): Popup {
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

  return popup;
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

const EMPTY_SOURCE_DATA: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function addLayers(map: MapLibreMap) {
  for (const { id } of SOURCE_KINDS) {
    map.addSource(id, { type: "geojson", data: EMPTY_SOURCE_DATA });
  }

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
    paint: { "line-color": ["get", "color"], "line-width": OUTLINE_WIDTH },
  });
  // Flow overlay: surface-coloured dashes travelling along the boundary the
  // layer above already drew in its own colour, so what animates reads as
  // moving gaps in that line rather than as a second line of its own. Paired
  // with its base layer in the stack — see startDashAnimation().
  map.addLayer({
    id: "polygons-flow",
    type: "line",
    source: "polygons",
    paint: {
      "line-color": surfaceColor(),
      "line-width": OUTLINE_WIDTH,
      "line-dasharray": DASH_SEQUENCE[0],
    },
  });

  // casing under stroke: a wider surface-colour line beneath the layer
  // colour keeps every line legible on both themes (design system §2).
  map.addLayer({
    id: "lines-casing",
    type: "line",
    source: "lines",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": isDark() ? BACKGROUND_DARK : BACKGROUND_LIGHT,
      "line-width": LINE_CASING_WIDTH,
    },
  });
  map.addLayer({
    id: "lines",
    type: "line",
    source: "lines",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": LINE_WIDTH },
  });
  map.addLayer({
    id: "lines-flow",
    type: "line",
    source: "lines",
    // Butt caps, not round: a round cap on every dash bleeds the dashes into
    // each other and the flow stops reading as movement.
    layout: { "line-cap": "butt", "line-join": "round" },
    paint: {
      "line-color": surfaceColor(),
      "line-width": LINE_WIDTH,
      "line-dasharray": DASH_SEQUENCE[0],
    },
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
}

// The three shared GeoJSON sources, and which geometry types feed each.
const SOURCE_KINDS = [
  { id: "polygons", types: POLYGON_TYPES },
  { id: "lines", types: LINE_TYPES },
  { id: "points", types: POINT_TYPES },
] as const;

/**
 * What each source currently holds, so a toggle that doesn't change a given
 * source can skip it entirely. `data` is compared by identity (a new
 * collection means a new role's layers); `keys` is the sorted list of visible
 * layer ids that produced each source's contents.
 */
export interface AppliedSources {
  data: LayerCollection | null;
  keys: Record<string, string>;
}

export function emptyAppliedSources(): AppliedSources {
  return { data: null, keys: {} };
}

/**
 * Pushes the switched-on features into the map sources.
 *
 * Visibility is applied HERE, by choosing what goes into each source — not
 * with setFilter on the style layers. That is deliberate and load-bearing:
 * Style.setFilter calls _updateLayer, which marks the whole source 'reload'
 * and re-parses every feature in it on the worker. These sources are shared
 * by every layer of a geometry type — the polygons source alone carries
 * ~3,200 features / ~7 MB once District and Survey Numbers are in it — so
 * filter-based toggling re-tessellated all of it on every switch, which is
 * what made switching a layer off visibly lag. Feeding the source only what
 * should draw makes the work proportional to what is actually on screen, and
 * switching the last layer off becomes a parse of nothing.
 *
 * The flow layers keep a filter, but a constant one (the animated ids never
 * change at runtime) — and setFilter no-ops on a deep-equal value, so it
 * costs nothing after the first call.
 */
function syncSources(
  map: MapLibreMap,
  data: LayerCollection,
  visibility: Record<number, boolean>,
  animatedIds: number[],
  applied: AppliedSources,
) {
  const dataChanged = applied.data !== data;

  for (const { id, types } of SOURCE_KINDS) {
    const features = data.features.filter(
      (f) => visibility[f.properties.id] && types.has(f.geometry.type),
    );
    // Layer ids, not feature ids: what a source holds is fully determined by
    // which layers are on, so this is a cheap and exact change check.
    const key = [...new Set(features.map((f) => f.properties.id))].sort((a, b) => a - b).join(",");
    if (!dataChanged && applied.keys[id] === key) continue;

    const source = map.getSource<GeoJSONSource>(id);
    if (!source) continue;
    source.setData(byGeometryType(features));
    applied.keys[id] = key;
  }

  applied.data = data;

  const flowFilter: FilterSpecification = ["in", ["get", "id"], ["literal", animatedIds]];
  for (const layerId of FLOW_LAYER_IDS) {
    if (map.getLayer(layerId)) map.setFilter(layerId, flowFilter);
  }
}

/**
 * Drives the looping dash animation on the flow layers, and returns a stop
 * function. Time-based rather than frame-counted, so the loop runs at the
 * same speed on any display refresh rate, and the paint property is only
 * touched when the frame index actually changes — at 65ms a step that is
 * roughly every fourth animation frame on a 60Hz screen.
 */
function startDashAnimation(map: MapLibreMap): () => void {
  let frame = 0;
  let lastStep = -1;

  function tick(timestamp: number) {
    const step = Math.floor(timestamp / DASH_STEP_MS) % DASH_SEQUENCE.length;
    if (step !== lastStep) {
      lastStep = step;
      for (const layerId of FLOW_LAYER_IDS) {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "line-dasharray", DASH_SEQUENCE[step]);
        }
      }
    }
    frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

function render(
  map: MapLibreMap,
  data: LayerCollection,
  visibility: Record<number, boolean>,
  animatedIds: number[],
  fitOnce: { done: boolean },
  applied: AppliedSources,
) {
  // Sources are created empty — nothing is visible until a layer is switched
  // on, so there is nothing to parse up front either.
  if (!map.getSource("polygons")) addLayers(map);
  syncSources(map, data, visibility, animatedIds, applied);

  if (!fitOnce.done) {
    // Fitted against the whole dataset, not the visible subset: the initial
    // view shouldn't depend on which layers happen to be on.
    const bounds = data.features.map(boundsOfFeature).find(Boolean);
    if (bounds) {
      map.fitBounds(bounds, { padding: 40, animate: false });
      fitOnce.done = true;
    }
  }
}

// Every effect below gates on mapReady — the "load" event having fired — and
// NOT on map.isStyleLoaded(). They are not the same thing, and the difference
// was a real bug: Style.loaded() also returns false while any source has a
// pending setData, while any raster tile is in flight, or while an image
// source is still downloading. Basemap tiles are in flight on every pan and
// zoom, so isStyleLoaded() is false much of the time, and a toggle landing in
// that window was dropped with no retry — the layer stayed on the map until
// something else happened to change the effect's deps. setFilter/addLayer/
// removeLayer/setData only need the style to exist, which "load" guarantees.
export default function Map({
  data,
  visibility,
  onReady,
  rasterLayers,
  animatedLayerIds,
}: {
  data: LayerCollection;
  visibility: Record<number, boolean>;
  onReady?: (map: MapLibreMap) => void;
  rasterLayers?: ActiveRasterLayer[];
  /**
   * Numeric ids whose geometry gets the looping dash animation — the Base
   * Layers section, resolved by the caller. Everything else draws solid.
   */
  animatedLayerIds?: number[];
}) {
  const [mapReady, setMapReady] = useState(false);
  // Seeded from the reduced-motion media query and then kept in sync with it,
  // so turning the OS setting on stops the loop without a reload. Safe to read
  // during the initial render: this component is only ever loaded client-side
  // (dynamic(..., { ssr: false }) in MapDashboard).
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dataRef = useRef(data);
  const visibilityRef = useRef(visibility);
  const fitOnceRef = useRef({ done: false });
  const rasterLayersRef = useRef(rasterLayers);
  const animatedIdsRef = useRef(animatedLayerIds);
  const popupRef = useRef<Popup | null>(null);
  const appliedSourcesRef = useRef<AppliedSources>(emptyAppliedSources());
  // globalThis.Map, not the local Map component this function is itself named after.
  const appliedRasterRef = useRef(new globalThis.Map<string, { url: string; extent: RasterExtent }>());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    visibilityRef.current = visibility;
  }, [visibility]);

  useEffect(() => {
    rasterLayersRef.current = rasterLayers;
  }, [rasterLayers]);

  useEffect(() => {
    animatedIdsRef.current = animatedLayerIds;
  }, [animatedLayerIds]);

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

    // Mirrors the mapReady state for callbacks that live inside this
    // mount-once effect and so can never see it.
    let loaded = false;

    map.on("load", () => {
      render(
        map,
        dataRef.current,
        visibilityRef.current,
        animatedIdsRef.current ?? [],
        fitOnceRef.current,
        appliedSourcesRef.current,
      );
      popupRef.current = attachPopups(map);
      syncRasterLayers(map, rasterLayersRef.current ?? [], appliedRasterRef.current);
      loaded = true;
      setMapReady(true);
      onReady?.(map);
    });

    const observer = new MutationObserver(() => {
      if (!loaded) return;
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

  // raster overlays: add/remove/swap image sources as layers are toggled or
  // their selected year changes, without touching the vector sources.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncRasterLayers(map, rasterLayers ?? [], appliedRasterRef.current);
  }, [rasterLayers, mapReady]);

  // Data arriving and layers being toggled are the same operation now — both
  // change which features belong in the sources — so they share one effect.
  // Never re-fetches or refits; syncSources skips any source whose contents
  // haven't actually changed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    render(
      map,
      data,
      visibility,
      animatedLayerIds ?? [],
      fitOnceRef.current,
      appliedSourcesRef.current,
    );
    // An open attribute popup is a DOM overlay, not a styled layer, so
    // dropping the feature from the source can't hide it — switching a layer
    // off would otherwise leave its popup floating over nothing.
    popupRef.current?.remove();
  }, [data, visibility, animatedLayerIds, mapReady]);

  // The dash loop runs only while an animated layer is actually on screen —
  // an rAF loop repainting the map behind a Theme raster would be pure waste.
  // Honouring prefers-reduced-motion leaves the dashes in place but static,
  // so the layers still look the same, just without the movement.
  const animatedOnCount = (animatedLayerIds ?? []).filter((id) => visibility[id]).length;

  useEffect(() => {
    const media = window.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || animatedOnCount === 0 || reducedMotion) return;
    return startDashAnimation(map);
  }, [mapReady, animatedOnCount, reducedMotion]);

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
      />
    </div>
  );
}

export type { LayerFeature };
