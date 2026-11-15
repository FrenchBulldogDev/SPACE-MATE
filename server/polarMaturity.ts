import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fromArrayBuffer } from 'geotiff';
import type { RasterLayer } from '../src/science/surfaceLayers';
import { scientificZip } from './scientificZip';

export const POLAR_CITATION = 'https://zenodo.org/records/7108163';
const checksums = { north: '7e4e1c5babe681776726a049565a2216', south: 'e89289739e46d2d1aea902823c2bb996' } as const;
type Pole = keyof typeof checksums;
const pending = new Map<Pole, Promise<RasterLayer>>();
const folder = 'data/surface-layers';
const digest = (bytes: Uint8Array | string, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
export function loadPolarMaturity(pole: Pole) {
  if (!pending.has(pole)) { const p = acquire(pole); pending.set(pole, p); void p.catch(() => pending.delete(pole)); }
  return pending.get(pole)!;
}
export function polarStereographic(latitude: number, longitude: number, pole: Pole): [number, number] {
  if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) > 90 || (pole === 'north' ? latitude < 50 : latitude > -50)) throw Error('Outside published polar OMAT coverage');
  const radius = 1737400, phi = latitude * Math.PI / 180, lambda = longitude * Math.PI / 180;
  const rho = 2 * radius * Math.tan(Math.PI / 4 + (pole === 'north' ? -phi : phi) / 2);
  return [rho * Math.sin(lambda), (pole === 'north' ? -1 : 1) * rho * Math.cos(lambda)];
}
async function acquire(pole: Pole): Promise<RasterLayer> {
  const stem = `${folder}/kaguya-sp-lola-omat-${pole}-v2`, archiveName = `gridded_omat_mosaic_${pole}_pole.tif.zip`;
  const source = `${POLAR_CITATION}/files/${archiveName}?download=1`;
  try {
    const [text, metaText] = await Promise.all([readFile(`${stem}.grid.json`, 'utf8'), readFile(`${stem}.json`, 'utf8')]);
    const meta = JSON.parse(metaText), layer: RasterLayer = JSON.parse(text);
    if (meta.gridSha256 !== digest(text) || meta.archiveMd5 !== checksums[pole] || layer.source !== source || layer.width !== 720 || layer.height !== 80 || layer.values.length !== 57600 || layer.region !== pole) throw Error('Polar scientific cache integrity failure');
    return layer;
  } catch { /* Reconstruct only from the verified published data. */ }
  const rawPath = `${folder}/polar-source/${archiveName}`;
  let bytes: Uint8Array;
  try { bytes = await readFile(rawPath); } catch {
    const response = await fetch(source, { headers: { 'User-Agent': 'SPACE-MATE/0.1 (public lunar science data ingestion)' }, signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw Error('Published polar OMAT data unavailable');
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  if (digest(bytes, 'md5') !== checksums[pole]) throw Error('Polar archive differs from the authors’ published MD5');
  const files = scientificZip(bytes), imageName = `gridded_omat_mosaic_${pole}_pole.tif`;
  const imageBytes = files.get(imageName), xmlBytes = files.get(`${imageName}.aux.xml`);
  if (!imageBytes || !xmlBytes) throw Error('Missing original polar raster/georeference');
  const xml = Buffer.from(xmlBytes).toString('utf8');
  const wkt = xml.match(/<WKT>([^<]+)<\/WKT>/)?.[1];
  if (!wkt?.includes(`Stereographic_${pole === 'north' ? 'North' : 'South'}_Pole`) || !wkt.includes('1737400.0,0.0') || !wkt.includes('"central_meridian",0.0') || !wkt.includes(`"standard_parallel_1",${pole === 'north' ? '90.0' : '-90.0'}`)) throw Error('Unsupported lunar polar coordinate system');
  const image = await (await fromArrayBuffer(imageBytes.slice().buffer as ArrayBuffer)).getImage();
  if (image.getWidth() !== 2529 || image.getHeight() !== 2529 || image.getSamplesPerPixel() !== 1 || image.getSampleFormat(0) !== 3) throw Error('Polar data must be the original numeric OMAT raster');
  // The v2 archives supply an ESRI polynomial transform in .aux.xml, not
  // embedded GeoTIFF keys. Its source coordinates are TIFF physical image
  // units (100 pixels/unit). Apply the published transform, never v1's .tfwx.
  const doubles = (tag: string) => [...(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? '').matchAll(/<Double>([^<]+)<\/Double>/g)].map(m => Number(m[1]));
  const from = doubles('SourceGCPs'), to = doubles('TargetGCPs');
  const expectedFrom = [25.29, 0, 0, 0, 0, 25.29, 25.29, 25.29], expectedTo = [1267472, 1267472, -1267472, 1267472, -1267472, -1267472, 1267472, -1267472];
  if (from.length !== 8 || to.length !== 8 || from.some((v, i) => Math.abs(v - expectedFrom[i]) > 1e-8) || to.some((v, i) => v !== expectedTo[i])) throw Error('Polar published ground control points changed');
  const [xRes, yRes] = await Promise.all([image.getFileDirectory().loadValue('XResolution'), image.getFileDirectory().loadValue('YResolution')]);
  const rationalValue = (value: unknown) => typeof value === 'number' ? value : value && typeof value === 'object' && '0' in value && '1' in value ? Number(value[0]) / Number(value[1]) : NaN;
  if (rationalValue(xRes) !== 100 || rationalValue(yRes) !== 100) throw Error('Unexpected TIFF image coordinate units');
  const westMeters = to[2], eastMeters = to[0], northMeters = to[1], southMeters = to[5];
  const pixelWidth = (eastMeters - westMeters) / (from[0] * 100), pixelHeight = (northMeters - southMeters) / (from[5] * 100);
  const raw = await image.readRasters({ samples: [0], interleave: true }) as Float32Array;
  const width = 720, height = 80, north = pole === 'north' ? 90 : -50, south = pole === 'north' ? 50 : -90;
  const values: (number | null)[] = [];
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const lat = north - (row + 0.5) * 0.5, lon = -180 + (column + 0.5) * 0.5;
    const [x, y] = polarStereographic(lat, lon, pole);
    const ix = Math.floor((x - westMeters) / pixelWidth), iy = Math.floor((northMeters - y) / pixelHeight);
    const v = ix >= 0 && iy >= 0 && ix < image.getWidth() && iy < image.getHeight() ? raw[iy * image.getWidth() + ix] : NaN;
    // Negative values (-10 in the original) cannot be an OMAT norm. Preserve
    // missing pixels instead of interpolating observations into them.
    values.push(Number.isFinite(v) && v >= 0 ? v : null);
  }
  if (!values.some(v => v !== null)) throw Error('No valid polar OMAT data');
  const layer: RasterLayer = { version: 1, width, height, west: -180, east: 180, north, south, values, units: 'OMAT',
    source, citation: POLAR_CITATION, fetchedAt: new Date().toISOString(), sha256: digest(imageBytes), resolutionDegrees: 0.5,
    region: pole, archiveSha256: digest(bytes), archiveMd5: checksums[pole] };
  const text = JSON.stringify(layer);
  await mkdir(`${folder}/polar-source`, { recursive: true });
  await writeFile(rawPath, bytes);
  await writeFile(`${stem}.grid.json`, text);
  await writeFile(`${stem}.json`, JSON.stringify({ source, citation: POLAR_CITATION, archiveMd5: checksums[pole], archiveSha256: digest(bytes), gridSha256: digest(text), imageSha256: digest(imageBytes), wkt, sourceGCPs: from, targetGCPs: to, pixelWidthMeters: pixelWidth, pixelHeightMeters: pixelHeight, method: 'Spherical polar stereographic on Moon 2000; nearest source cell, no gap filling', license: 'CC BY 4.0', attribution: 'Lemelin, Lucey & Camon (2022), version 2, doi:10.5281/zenodo.7108163' }, null, 2));
  return layer;
}
