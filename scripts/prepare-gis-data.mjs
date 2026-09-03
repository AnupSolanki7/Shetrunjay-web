#!/usr/bin/env node
// Converts raw GIS vector data (delivered as GeoJSON, already EPSG:4326) into
// the static assets served from public/gis/. Re-run whenever DATA_DIR changes
// — every output is fully regenerated, nothing here is hand-edited.
//
// Usage: node scripts/prepare-gis-data.mjs [--data-dir <path>]

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function flagOrEnv(flag, envVar, fallback) {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  if (i !== -1) return path.resolve(args[i + 1]);
  if (process.env[envVar]) return path.resolve(process.env[envVar]);
  return fallback;
}

const DATA_DIR = flagOrEnv("--data-dir", "DATA_DIR", path.join(REPO_ROOT, "Vector"));
const RASTER_DIR = flagOrEnv("--raster-dir", "RASTER_DATA_DIR", path.join(REPO_ROOT, "Raster"));

const OUT_DIR = path.join(REPO_ROOT, "public", "gis", "vector");
const RASTER_OUT_DIR = path.join(REPO_ROOT, "public", "gis", "raster");
const MANIFEST_PATH = path.join(REPO_ROOT, "public", "gis", "manifest.json");

// Longest side after downsampling — the source drone rasters are ~31,000px
// wide (189-599MB each); this keeps every raster well under typical WebGL
// max-texture-size limits and static-hosting-friendly.
const RASTER_MAX_DIM = 4096;

// Coordinates round to ~1m precision — plenty for this zoom range, and a
// meaningful size reduction on multi-thousand-vertex geometries.
const COORD_PRECISION = "0.00001";

/**
 * @typedef {{
 *   id: string,
 *   src: string,
 *   simplifyPct?: number,
 * }} SourceEntry
 */

/** @type {SourceEntry[]} */
const SOURCES = [
  { id: "forest-boundary", src: "ForestBoundary.geojson" },
  { id: "survey-number", src: "SurveyNumber.geojson" },
  // Natural drainage/watershed lines — simplified for display; not survey-grade.
  { id: "streams", src: "Streams.geojson", simplifyPct: 8 },
  { id: "catchments", src: "Catchments.geojson", simplifyPct: 8 },
  { id: "district", src: "DistrictBoundary.geojson", simplifyPct: 10 },
  { id: "taluka", src: "Talukas.geojson" },
  { id: "village", src: "Villages.geojson" },
  { id: "roads", src: "Roads.geojson" },
  { id: "rivers", src: "Rivers.geojson" },
  { id: "grids", src: "PalitanaGrids.geojson" },
  { id: "zones", src: "Zones.geojson" },
  { id: "tracks", src: "Tracks.geojson" },
  { id: "steps", src: "Steps.geojson" },
  { id: "smc-vantalavadi", src: "SMC/Vantalawadi.geojson" },
  { id: "smc-matipala", src: "SMC/Matipala.geojson" },
  { id: "smc-checkdam", src: "SMC/Check Dam.geojson" },
  { id: "smc-causeway", src: "SMC/Causeway.geojson" },
  { id: "study-area", src: "PalitanaStudyArea.geojson" },
];

// Multi-year raster themes: source dir + per-year source filename, relative
// to RASTER_DIR. Extents live in lib/gis-registry.ts (transcribed from the
// delivered EXTENT.docx files) — this only moves and downsamples pixels.
const RASTER_YEAR_THEMES = [
  // Forest Cover and Green Cover are distinct themes sharing one Drive folder:
  // Forest Cover is the 5-class density classification (VDF/MDF/Open/Scrub/
  // Non-Forest), Green Cover the 2-class binary. Confirmed against the client's
  // colour doc and the images' own palettes. Forest Cover has no 2026.
  {
    id: "forest-cover",
    dir: "Forest Cover",
    years: { 1980: "1980.png", 1989: "1989.png", 1998: "1998.png", 2008: "2008.png", 2018: "2018.png", 2025: "2025.png" },
  },
  {
    id: "green-cover",
    dir: "Green Cover",
    years: { 1980: "1980.png", 1989: "1989.png", 1998: "1998.png", 2008: "2008.png", 2018: "2018.png", 2025: "2025.png", 2026: "2026.png" },
  },
  {
    id: "lulc",
    dir: "LULC",
    years: { 1980: "1980.png", 1989: "1989.png", 1998: "1998.png", 2008: "2008.png", 2018: "2018.png", 2025: "2025.png", 2026: "2026.png" },
  },
  {
    id: "fragmentation",
    dir: "Fragmentation",
    years: { 1980: "1980.png", 1989: "1989.png", 1998: "1998.png", 2008: "2008.png", 2018: "2018.png", 2025: "2025.png", 2026: "2026.png" },
  },
  {
    id: "fcc",
    dir: "FCC",
    years: { 1980: "1980.png", 1989: "1989.png", 1998: "1998.png", 2008: "2008.png", 2018: "2018.png", 2025: "2025.png", 2026: "2026.png" },
  },
  {
    id: "vegetation-change",
    dir: "Vegetation Change",
    // filenames are "<to> over <from>.png" — output is keyed by the "to" year.
    years: {
      1989: "1989 over 1980.png",
      1998: "1998 over 1989.png",
      2008: "2008 over 1998.png",
      2018: "2018 over 2008.png",
      2025: "2025 over 2018.png",
      2026: "2026 over 2025.png",
    },
  },
];

// Single-snapshot raster themes (no year selector).
const RASTER_SINGLE_THEMES = [
  { id: "ortho", dir: "Drone Data", src: "Ortho.png" },
  { id: "dtm", dir: "Drone Data", src: "DTM_2000.png" },
  { id: "chm", dir: "Drone Data", src: "CHM_2000.png" },
  { id: "slope", dir: "Drone Data", src: "Slope_2000.png" },
  { id: "aspect", dir: "Drone Data", src: "Aspect_2000.png" },
];

async function convertRaster(srcPath, outPath) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(srcPath, { limitInputPixels: false })
    .resize({ width: RASTER_MAX_DIM, height: RASTER_MAX_DIM, fit: "inside", withoutEnlargement: true })
    // palette mode (adaptive quantized PNG) — big win on the classified
    // theme rasters (few flat colors), and still a meaningful reduction on
    // the photographic/gradient ones without visibly harming a dashboard
    // overlay's legibility.
    .png({ compressionLevel: 9, palette: true })
    .toFile(outPath);
  return fs.stat(outPath);
}

async function convertRasterThemes() {
  const results = [];

  for (const theme of RASTER_YEAR_THEMES) {
    for (const [year, filename] of Object.entries(theme.years)) {
      const srcPath = path.join(RASTER_DIR, theme.dir, filename);
      const outPath = path.join(RASTER_OUT_DIR, theme.id, `${year}.png`);
      const srcStat = await fs.stat(srcPath).catch(() => null);
      if (!srcStat) {
        results.push({ id: `${theme.id}/${year}`, status: "missing-source", src: path.join(theme.dir, filename) });
        continue;
      }
      process.stdout.write(`converting raster ${theme.id}/${year} ... `);
      const outStat = await convertRaster(srcPath, outPath);
      console.log(`${(srcStat.size / 1024 / 1024).toFixed(1)}MB -> ${(outStat.size / 1024 / 1024).toFixed(2)}MB`);
      results.push({ id: `${theme.id}/${year}`, status: "ok", srcBytes: srcStat.size, outBytes: outStat.size });
    }
  }

  for (const theme of RASTER_SINGLE_THEMES) {
    const srcPath = path.join(RASTER_DIR, theme.dir, theme.src);
    const outPath = path.join(RASTER_OUT_DIR, theme.id, `${theme.id}.png`);
    const srcStat = await fs.stat(srcPath).catch(() => null);
    if (!srcStat) {
      results.push({ id: theme.id, status: "missing-source", src: path.join(theme.dir, theme.src) });
      continue;
    }
    process.stdout.write(`converting raster ${theme.id} ... `);
    const outStat = await convertRaster(srcPath, outPath);
    console.log(`${(srcStat.size / 1024 / 1024).toFixed(1)}MB -> ${(outStat.size / 1024 / 1024).toFixed(2)}MB`);
    results.push({ id: theme.id, status: "ok", srcBytes: srcStat.size, outBytes: outStat.size });
  }

  return results;
}

function runMapshaper(cmd) {
  return new Promise((resolve, reject) => {
    mapshaper.runCommands(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

async function convertOne(entry) {
  const srcPath = path.join(DATA_DIR, entry.src);
  const outPath = path.join(OUT_DIR, `${entry.id}.geojson`);

  const srcStat = await fs.stat(srcPath).catch(() => null);
  if (!srcStat) {
    return { id: entry.id, status: "missing-source", src: entry.src };
  }

  const simplify = entry.simplifyPct
    ? `-simplify ${entry.simplifyPct}% keep-shapes -clean `
    : "";
  const cmd =
    `-i "${srcPath}" ` +
    simplify +
    `-o "${outPath}" precision=${COORD_PRECISION} format=geojson`;

  await runMapshaper(cmd);
  const outStat = await fs.stat(outPath);

  const geojson = JSON.parse(await fs.readFile(outPath, "utf-8"));
  const featureCount = geojson.features?.length ?? 0;

  return {
    id: entry.id,
    status: "ok",
    src: entry.src,
    srcBytes: srcStat.size,
    outBytes: outStat.size,
    featureCount,
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const results = [];
  for (const entry of SOURCES) {
    process.stdout.write(`converting ${entry.id} ... `);
    const result = await convertOne(entry);
    results.push(result);
    if (result.status === "ok") {
      const before = (result.srcBytes / 1024).toFixed(0);
      const after = (result.outBytes / 1024).toFixed(0);
      console.log(`${before}KB -> ${after}KB (${result.featureCount} features)`);
    } else {
      console.log(`SKIPPED (source not found: ${result.src})`);
    }
  }

  console.log("");
  const rasterResults = await convertRasterThemes();

  const manifest = {
    generatedFrom: DATA_DIR,
    generatedFromRaster: RASTER_DIR,
    layers: Object.fromEntries(
      results
        .filter((r) => r.status === "ok")
        .map((r) => [
          r.id,
          { path: `gis/vector/${r.id}.geojson`, bytes: r.outBytes, featureCount: r.featureCount },
        ]),
    ),
    rasters: Object.fromEntries(
      rasterResults.filter((r) => r.status === "ok").map((r) => [r.id, { bytes: r.outBytes }]),
    ),
  };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  const missing = [...results, ...rasterResults].filter((r) => r.status !== "ok");
  if (missing.length) {
    console.warn(`\n${missing.length} source file(s) not found, skipped:`);
    for (const m of missing) console.warn(`  - ${m.id}: ${m.src}`);
  }

  const totalOut = results.reduce((sum, r) => sum + (r.outBytes ?? 0), 0);
  const totalRasterOut = rasterResults.reduce((sum, r) => sum + (r.outBytes ?? 0), 0);
  console.log(`\nWrote ${MANIFEST_PATH}`);
  console.log(`Total public/gis/vector/ weight: ${(totalOut / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total public/gis/raster/ weight: ${(totalRasterOut / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
