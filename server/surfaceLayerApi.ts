import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fromArrayBuffer } from 'geotiff';
import type { Plugin } from 'vite';
import type { RasterLayer } from '../src/science/surfaceLayers';
import { loadPolarMaturity } from './polarMaturity';

export const OMAT_SERVICE = 'https://trek.nasa.gov/moon/trekarcgis/rest/services/Lunar_Kaguya_MIMap_MineralDeconv_OpticalMaturityIndex_50N50S/ImageServer';
const citation = 'https://astrogeology.usgs.gov/search/map/kaguya_lunar_multiband_imager_mi_derived_optical_maturity_omat_50n50s_512ppd_59mpp';
const directory = 'data/surface-layers';
const width = 720, height = 200, bbox = [-180, -50, 180, 50];
const params = new URLSearchParams({ f: 'image', bbox: bbox.join(','), bboxSR: '104903', imageSR: '104903', size: `${width},${height}`,
  pixelType: 'F32', format: 'tiff', interpolation: 'RSP_NearestNeighbor', adjustAspectRatio: 'false', renderingRule: JSON.stringify({ rasterFunction: 'None' }) });
const source = `${OMAT_SERVICE}/exportImage?${params}`;
let loading: Promise<RasterLayer> | undefined;
export function loadOpticalMaturity() {
  if (!loading) {
    loading = acquire();
    void loading.catch(() => { loading = undefined; });
  }
  return loading;
}
async function acquire(): Promise<RasterLayer> {
  const file = `${directory}/kaguya-omat-v1`;
  let bytes: Uint8Array, fetchedAt: string, checksum: string;
  try {
    const saved = JSON.parse(await readFile(`${file}.json`, 'utf8'));
    bytes = await readFile(`${file}.tif`);
    checksum = createHash('sha256').update(bytes).digest('hex');
    if (saved.source !== source || saved.sha256 !== checksum) throw Error('Scientific cache checksum mismatch');
    fetchedAt = saved.fetchedAt;
  } catch {
    const metadataResponse = await fetch(`${OMAT_SERVICE}?f=pjson`, { signal: AbortSignal.timeout(30000) });
    if (!metadataResponse.ok) throw Error('NASA layer metadata unavailable');
    const metadata = await metadataResponse.json();
    if (metadata.bandCount !== 1 || metadata.pixelType !== 'F32' || metadata.spatialReference?.wkid !== 104903 || metadata.extent?.xmin !== -180 || metadata.extent?.xmax !== 180 || metadata.extent?.ymin !== -50 || metadata.extent?.ymax !== 50) throw Error('NASA scientific layer metadata changed');
    const response = await fetch(source, { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw Error('NASA numeric OMAT raster unavailable');
    bytes = new Uint8Array(await response.arrayBuffer());
    checksum = createHash('sha256').update(bytes).digest('hex');
    fetchedAt = new Date().toISOString();
    // Decode and validate before persisting a response as a scientific raster.
    const raster = await decode(bytes, fetchedAt, checksum);
    await mkdir(directory, { recursive: true });
    await writeFile(`${file}.tif`, bytes);
    await writeFile(`${file}.json`, JSON.stringify({ source, citation, fetchedAt, sha256: checksum, metadata }, null, 2));
    return raster;
  }
  return decode(bytes, fetchedAt, checksum);
}
async function decode(bytes: Uint8Array, fetchedAt: string, sha256: string): Promise<RasterLayer> {
  const image = await (await fromArrayBuffer(bytes.slice().buffer as ArrayBuffer)).getImage();
  if (image.getWidth() !== width || image.getHeight() !== height || image.getSamplesPerPixel() !== 1 || image.getSampleFormat(0) !== 3) throw Error('Expected a raw one-band floating-point OMAT GeoTIFF');
  if (image.getBoundingBox().some((v, i) => Math.abs(v - bbox[i]) > 1e-6)) throw Error('Incorrect lunar raster registration');
  const noData = image.getGDALNoData();
  const pixels = await image.readRasters({ samples: [0], interleave: true });
  const values = Array.from(pixels as Float32Array, v => !Number.isFinite(v) || v === noData ? null : v);
  if (!values.some(v => v !== null)) throw Error('OMAT raster has no valid measurements');
  if (values.some(v => v !== null && v < 0)) throw Error('Unexpected negative OMAT values');
  return { version: 1, width, height, west: -180, east: 180, south: -50, north: 50, values, units: 'OMAT',
    source, citation, fetchedAt, sha256, resolutionDegrees: 0.5 };
}
export function surfaceLayerMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname !== '/api/surface-layer') { next(); return; }
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  if (url.searchParams.get('layer') !== 'weathering') { res.writeHead(400).end(JSON.stringify({ error: 'Unsupported scientific layer' })); return; }
  const result = url.searchParams.get('coverage') === 'global'
    ? Promise.all([loadOpticalMaturity(), loadPolarMaturity('north'), loadPolarMaturity('south')]).then(layers => ({ version: 2, layers }))
    : loadOpticalMaturity();
  void result.then(layer => { res.setHeader('Cache-Control', 'public, max-age=86400'); res.end(JSON.stringify(layer)); })
    .catch(() => { res.writeHead(503).end(JSON.stringify({ error: 'Verified NASA optical maturity data unavailable' })); });
}
export function surfaceLayerPlugin(): Plugin {
  return { name: 'verified-surface-layers', configureServer(server) { server.middlewares.use(surfaceLayerMiddleware); }, configurePreviewServer(server) { server.middlewares.use(surfaceLayerMiddleware); } };
}
