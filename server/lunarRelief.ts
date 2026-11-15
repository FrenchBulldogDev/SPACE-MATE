import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fromArrayBuffer } from 'geotiff';
import { BufferAttribute, BufferGeometry, DoubleSide, Ray } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Vec3 } from '../src/science/types';
import { TREK_DEM, type FarField, type Sight } from './lunarTerrain';

// Far-field relief for rays that leave a local DEM patch. The whole LOLA DEM
// is sampled at 16 points per degree (~1.9 km) and pooled into 4 cells per
// degree (~7.6 km), keeping the highest and lowest sample of every cell.
export const RELIEF_SAMPLES_PER_DEGREE = 16;
export const RELIEF_CELLS_PER_DEGREE = 4;
// Point samples miss relief between them, so the upper surface is raised and
// the lower one dropped by this margin. Measured against 34,979 cells of the
// ~237-m local DEM (137 patches): the fine terrain exceeded the unpadded
// envelope by up to 674 m (99.9% within 500 m) and never exceeded it at 700 m.
// The margin also covers the ~8 m that flat 7.6-km triangles sag below a sphere.
export const RELIEF_PAD_METERS = 750;
export type ReliefGrid = {
  version: 1; width: number; height: number; // cells, row 0 at the north pole, column 0 at 180° W
  maximum: number[]; minimum: number[]; cellsPerDegree: number; samplesPerDegree: number;
  sources: { url: string; sha256: string }[]; fetchedAt: string;
};

const RADIUS = 1737400, folder = 'data/terrain/global-relief-v1';

// Pure pooling step, separated from the download so it can be tested.
export function poolSamples(samples: ArrayLike<number>, width: number, height: number, factor: number, column: number, row: number, grid: ReliefGrid) {
  if (samples.length !== width * height || width % factor || height % factor) throw new Error('Relief tile does not match the pooling factor');
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = samples[y * width + x];
    if (!Number.isFinite(value) || Math.abs(value) > 15000) throw new Error('Relief tile has missing or invalid elevations');
    const cell = (row + Math.floor(y / factor)) * grid.width + column + Math.floor(x / factor);
    if (value > grid.maximum[cell]) grid.maximum[cell] = value;
    if (value < grid.minimum[cell]) grid.minimum[cell] = value;
  }
}

function validGrid(grid: ReliefGrid) {
  return grid?.version === 1 && grid.cellsPerDegree === RELIEF_CELLS_PER_DEGREE && grid.samplesPerDegree === RELIEF_SAMPLES_PER_DEGREE
    && grid.width === 360 * RELIEF_CELLS_PER_DEGREE && grid.height === 180 * RELIEF_CELLS_PER_DEGREE
    && Array.isArray(grid.maximum) && Array.isArray(grid.minimum) && grid.maximum.length === grid.width * grid.height && grid.minimum.length === grid.maximum.length
    && grid.maximum.every((v, i) => Number.isFinite(v) && Number.isFinite(grid.minimum[i]) && grid.minimum[i] <= v && Math.abs(v) <= 15000 && Math.abs(grid.minimum[i]) <= 15000);
}

async function acquireReliefGrid(): Promise<ReliefGrid> {
  const file = `${folder}/envelope.json`;
  try { const saved: ReliefGrid = JSON.parse(await readFile(file, 'utf8')); if (validGrid(saved)) return saved; } catch {}
  const width = 360 * RELIEF_CELLS_PER_DEGREE, height = 180 * RELIEF_CELLS_PER_DEGREE, factor = RELIEF_SAMPLES_PER_DEGREE / RELIEF_CELLS_PER_DEGREE;
  const grid: ReliefGrid = { version: 1, width, height, maximum: new Array(width * height).fill(-Infinity), minimum: new Array(width * height).fill(Infinity),
    cellsPerDegree: RELIEF_CELLS_PER_DEGREE, samplesPerDegree: RELIEF_SAMPLES_PER_DEGREE, sources: [], fetchedAt: new Date().toISOString() };
  await mkdir(folder, { recursive: true });
  // Eight 90° x 90° tiles stay well inside the service's 15000 x 4100 limit.
  const size = 90 * RELIEF_SAMPLES_PER_DEGREE;
  for (const north of [90, 0]) for (const west of [-180, -90, 0, 90]) {
    const bbox = [west, north - 90, west + 90, north];
    const params = new URLSearchParams({ f: 'image', bbox: bbox.join(','), bboxSR: '104903', imageSR: '104903', size: `${size},${size}`, pixelType: 'F32', format: 'tiff', interpolation: 'RSP_NearestNeighbor', adjustAspectRatio: 'false', renderingRule: JSON.stringify({ rasterFunction: 'None' }) });
    const url = `${TREK_DEM}/exportImage?${params}`, name = `${folder}/tile_${north}_${west}.tif`;
    let bytes: Uint8Array;
    try { bytes = await readFile(name); } catch {
      const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error('Moon Trek global relief download failed');
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    const image = await (await fromArrayBuffer(bytes.slice().buffer as ArrayBuffer)).getImage();
    if (image.getSamplesPerPixel() !== 1 || image.getWidth() !== size || image.getHeight() !== size || image.getSampleFormat(0) !== 3) throw new Error('Global relief must be single-band floating-point elevations');
    if (image.getBoundingBox().some((v, i) => Math.abs(v - bbox[i]) > 1e-5)) throw new Error('Unexpected global relief registration');
    const samples = await image.readRasters({ samples: [0], interleave: true }) as Float32Array;
    poolSamples(samples, size, size, factor, (west + 180) * RELIEF_CELLS_PER_DEGREE, (90 - north) * RELIEF_CELLS_PER_DEGREE, grid);
    // Keep the original bytes only after they decoded and validated.
    await writeFile(name, bytes);
    grid.sources.push({ url, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  if (!validGrid(grid)) throw new Error('Incomplete global relief');
  await writeFile(file, JSON.stringify(grid));
  return grid;
}

// Two closed surfaces around the whole Moon. Vertices sit on cell corners and
// take the extreme of the cells that touch the corner, so anywhere inside a
// cell the upper surface is at least that cell's highest sample plus the margin
// and the lower surface at most its lowest sample minus the margin. A ray that
// never touches the upper surface is clear; a ray that touches the lower one is
// blocked; a ray that only passes between them cannot be decided at this
// resolution and is 'unknown'.
export function reliefEnvelope(grid: ReliefGrid, padMeters = RELIEF_PAD_METERS): FarField & { dispose(): void } {
  if (grid.width < 2 || grid.height < 2 || grid.maximum.length !== grid.width * grid.height || grid.minimum.length !== grid.maximum.length) throw new Error('Invalid relief grid');
  const { width, height } = grid, columns = width + 1, rows = height + 1;
  const upper = new Float32Array(columns * rows * 3), lower = new Float32Array(columns * rows * 3);
  const polar = (row: number, values: number[], pick: (a: number, b: number) => number) => { let v = values[row * width]; for (let x = 1; x < width; x++) v = pick(v, values[row * width + x]); return v; };
  let highest = -Infinity;
  for (let j = 0; j < rows; j++) {
    const latitude = (90 - j * 180 / height) * Math.PI / 180, cosLat = Math.cos(latitude), sinLat = Math.sin(latitude);
    // Every vertex of a polar row is the same point and must share one height.
    const poleMax = j === 0 ? polar(0, grid.maximum, Math.max) : j === height ? polar(height - 1, grid.maximum, Math.max) : NaN;
    const poleMin = j === 0 ? polar(0, grid.minimum, Math.min) : j === height ? polar(height - 1, grid.minimum, Math.min) : NaN;
    for (let i = 0; i < columns; i++) {
      let top = poleMax, bottom = poleMin;
      if (j > 0 && j < height) {
        const east = i % width, west = (i + width - 1) % width; // The last column repeats the first across ±180°.
        top = Math.max(grid.maximum[(j - 1) * width + west], grid.maximum[(j - 1) * width + east], grid.maximum[j * width + west], grid.maximum[j * width + east]);
        bottom = Math.min(grid.minimum[(j - 1) * width + west], grid.minimum[(j - 1) * width + east], grid.minimum[j * width + west], grid.minimum[j * width + east]);
      }
      if (top > highest) highest = top;
      const longitude = (-180 + i * 360 / width) * Math.PI / 180, k = (j * columns + i) * 3;
      const x = cosLat * Math.cos(longitude), y = cosLat * Math.sin(longitude);
      upper[k] = (RADIUS + top + padMeters) * x; upper[k + 1] = (RADIUS + top + padMeters) * y; upper[k + 2] = (RADIUS + top + padMeters) * sinLat;
      lower[k] = (RADIUS + bottom - padMeters) * x; lower[k + 1] = (RADIUS + bottom - padMeters) * y; lower[k + 2] = (RADIUS + bottom - padMeters) * sinLat;
    }
  }
  const build = (vertices: Float32Array, topology?: ReturnType<typeof MeshBVH.serialize>) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    if (topology) {
      // Identical connectivity: copy the upper tree's partition, then refit
      // every bound against the unchanged lower vertices. No shared nodes.
      const bvh = MeshBVH.deserialize(topology, geometry);
      bvh.refit();
      return { geometry, bvh };
    }
    const index = new Uint32Array(width * height * 6);
    let next = 0;
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
      const a = j * columns + i, c = a + columns;
      index[next++] = a; index[next++] = c; index[next++] = a + 1;
      index[next++] = a + 1; index[next++] = c; index[next++] = c + 1;
    }
    geometry.setIndex(new BufferAttribute(index, 1));
    return { geometry, bvh: new MeshBVH(geometry) };
  };
  const top = build(upper), bottom = build(lower, MeshBVH.serialize(top.bvh)), ray = new Ray();
  return {
    // Float32 vertices carry ~0.1 m at lunar radius; the shell clears that too.
    shellMeters: highest + padMeters + 50,
    lineOfSight(origin: Vec3, direction: Vec3, near: number, far: number): Sight {
      ray.origin.set(origin[0], origin[1], origin[2]); ray.direction.set(direction[0], direction[1], direction[2]);
      if (!top.bvh.raycastFirst(ray, DoubleSide, near, far)) return 'clear';
      return bottom.bvh.raycastFirst(ray, DoubleSide, near, far) ? 'blocked' : 'unknown';
    },
    dispose() { top.geometry.dispose(); bottom.geometry.dispose(); },
  };
}

let relief: Promise<FarField> | undefined;
// One shared instance per process: the download is cached on disk and the two
// search trees are built once. A failure is not cached, so a retry can succeed.
export function loadLunarRelief(): Promise<FarField> {
  if (!relief) {
    const pending = acquireReliefGrid().then(grid => reliefEnvelope(grid));
    relief = pending;
    void pending.catch(() => { if (relief === pending) relief = undefined; });
  }
  return relief;
}
