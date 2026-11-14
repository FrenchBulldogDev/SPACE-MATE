import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fromArrayBuffer } from 'geotiff';
import { Box3, BufferGeometry, BufferAttribute, DoubleSide, Ray } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Vec3 } from '../src/science/types';
import { dot, length, normalize, sub } from '../src/science/vectors';

export const TREK_DEM = 'https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer';
export const lunarPoint = (lat: number, lon: number, height = 0): Vec3 => {
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180, r = 1737400 + height;
  return [r * Math.cos(p) * Math.cos(l), r * Math.cos(p) * Math.sin(l), r * Math.sin(p)];
};
export type TerrainGrid = { width: number; height: number; west: number; east: number; south: number; north: number; heights: number[]; source: string; fetchedAt: string };

const topologies = new Map<string, ReturnType<typeof MeshBVH.serialize>>();
function gridTopology(width: number, height: number) {
  const key = `${width}:${height}`;
  if (!topologies.has(key)) {
    // Connectivity is identical for every DEM of this size. Partition a flat
    // grid once; each real patch gets private node bounds, fully refitted to
    // its actual, unchanged 3D triangles before any ray can use it.
    const vertices = new Float32Array(width * height * 3);
    const indices = new Uint32Array((width - 1) * (height - 1) * 6);
    let next = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      vertices[3 * i] = x; vertices[3 * i + 1] = y;
      if (x && y) {
        indices[next++] = i; indices[next++] = i - 1; indices[next++] = i - width;
        indices[next++] = i - 1; indices[next++] = i - width - 1; indices[next++] = i - width;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(vertices, 3)); geometry.setIndex(new BufferAttribute(indices, 1));
    topologies.set(key, MeshBVH.serialize(new MeshBVH(geometry, { targetLeafSize: 32 }), { cloneBuffers: false }));
    geometry.dispose();
    while (topologies.size > 2) topologies.delete(topologies.keys().next().value!);
  }
  return topologies.get(key)!;
}

export async function loadTerrain(latitude: number, longitude: number, signal?: AbortSignal): Promise<TerrainGrid> {
  signal?.throwIfAborted();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 88 || Math.abs(longitude) > 178.8) throw new Error('Unsupported local DEM extent');
  const bbox = [longitude - 2, latitude - 2, longitude + 2, latitude + 2];
  // 4° / 512 ≈ 237 m north-south, ~2x the native 256 ppd global LOLA DEM.
  const params = new URLSearchParams({ f: 'image', bbox: bbox.join(','), bboxSR: '104903', imageSR: '104903', size: '512,512', pixelType: 'F32', format: 'tiff', interpolation: 'RSP_NearestNeighbor', adjustAspectRatio: 'false', renderingRule: JSON.stringify({rasterFunction:'None'}) });
  const source = `${TREK_DEM}/exportImage?${params}`;
  const id = createHash('sha256').update(source).digest('hex').slice(0, 24), file = `data/terrain/${id}.json`;
  try { return JSON.parse(await readFile(file, 'utf8')); } catch {}
  // Stream the TIFF directly. The service's JSON href points to an internal
  // /arcgis output path which is not reachable through Trek's public proxy.
  const image = await fetch(source, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000) });
  if (!image.ok) throw new Error('Moon Trek DEM download failed');
  const bytes = await image.arrayBuffer(), tiff = await fromArrayBuffer(bytes), raster = await tiff.getImage();
  if (raster.getSamplesPerPixel() !== 1 || raster.getWidth() !== 512 || raster.getHeight() !== 512 || raster.getSampleFormat(0) !== 3) throw new Error('DEM must be single-band floating-point elevations, not a rendered map');
  const pixels = await raster.readRasters({ samples: [0], interleave: true });
  const heights = Array.from(pixels as Float32Array);
  if (heights.some(h => !Number.isFinite(h) || h < -15000 || h > 15000)) throw new Error('DEM has missing or invalid elevations');
  const extent=raster.getBoundingBox();
  if(extent.some((v,i)=>Math.abs(v-bbox[i])>1e-5))throw new Error('Unexpected lunar DEM registration');
  const grid: TerrainGrid = { width: 512, height: 512, west: extent[0], east: extent[2], south: extent[1], north: extent[3], heights, source, fetchedAt: new Date().toISOString() };
  await mkdir('data/terrain', {recursive:true}); await writeFile(file, JSON.stringify(grid)); await writeFile(`data/terrain/${id}.tif`, new Uint8Array(bytes));
  return grid;
}

export class TerrainMask {
  geometry: BufferGeometry;
  bvh: MeshBVH;
  anchor: Vec3;
  resolutionMeters: number;
  private readonly ray = new Ray();
  constructor(public grid: TerrainGrid, latitude: number, longitude: number) {
    if(grid.width<3||grid.height<3||grid.heights.length!==grid.width*grid.height||grid.heights.some(h=>!Number.isFinite(h)||Math.abs(h)>15000))throw new Error('Invalid or incomplete numeric DEM');
    this.anchor = lunarPoint(latitude, longitude);
    this.resolutionMeters = 1737400 * Math.PI / 180 * Math.max((grid.east - grid.west) / grid.width, (grid.north - grid.south) / grid.height);
    // The same vertices and triangles, allocated once. Latitude/longitude
    // trigonometry depends on the row/column, not on each of 262,144 heights.
    const vertices = new Float32Array(grid.width * grid.height * 3);
    const cosLon = new Float64Array(grid.width), sinLon = new Float64Array(grid.width);
    for (let x = 0; x < grid.width; x++) {
      const lon = (grid.west + (x + 0.5) / grid.width * (grid.east - grid.west)) * Math.PI / 180;
      cosLon[x] = Math.cos(lon); sinLon[x] = Math.sin(lon);
    }
    for (let y = 0; y < grid.height; y++) {
      const lat = (grid.north - (y + 0.5) / grid.height * (grid.north - grid.south)) * Math.PI / 180;
      const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
      for (let x = 0; x < grid.width; x++) {
        const i = y * grid.width + x, r = 1737400 + grid.heights[i], k = i * 3;
        vertices[k] = r * cosLat * cosLon[x] - this.anchor[0];
        vertices[k + 1] = r * cosLat * sinLon[x] - this.anchor[1];
        vertices[k + 2] = r * sinLat - this.anchor[2];
      }
    }
    const topology = gridTopology(grid.width, grid.height);
    this.geometry = new BufferGeometry(); this.geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    this.geometry.setIndex(new BufferAttribute(topology.index!.slice(), 1));
    this.bvh = MeshBVH.deserialize({ ...topology, roots: topology.roots.map(root => root.slice(0)) }, this.geometry, { setIndex: false });
    this.bvh.refit();
    this.geometry.boundingBox = this.bvh.getBoundingBox(new Box3());
  }
  surface(latitude: number, longitude: number, height = 2) {
    const g = this.grid;
    const x = (longitude - g.west) / (g.east - g.west) * g.width - 0.5;
    const y = (g.north - latitude) / (g.north - g.south) * g.height - 0.5;
    if (x < 1 || y < 1 || x >= g.width - 2 || y >= g.height - 2) throw new Error('Site outside DEM interior');
    const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
    const at = (a:number,b:number) => g.heights[b * g.width + a];
    const h = at(ix,iy)*(1-u)*(1-v)+at(ix+1,iy)*u*(1-v)+at(ix,iy+1)*(1-u)*v+at(ix+1,iy+1)*u*v;
    return lunarPoint(latitude, longitude, h + height);
  }
  lineOfSight(origin: Vec3, target: Vec3): 'clear' | 'blocked' | 'unknown' {
    const direction = normalize(sub(target, origin)), r = length(origin), b = dot(origin, direction);
    // Any ray crossing a conservative inner solid sphere is blocked regardless
    // of local DEM coverage. The outer shell bounds potentially blocking relief.
    const inner = 1737400 - 20000, discInner = b*b - r*r + inner*inner;
    if (b < 0 && discInner > 0) return 'blocked';
    const exit = -b + Math.sqrt(Math.max(0, b*b - r*r + (1737400 + 20000)**2));
    const ray = this.ray;
    ray.origin.set(origin[0] - this.anchor[0], origin[1] - this.anchor[1], origin[2] - this.anchor[2]);
    ray.direction.set(direction[0], direction[1], direction[2]);
    if (this.bvh.raycastFirst(ray, DoubleSide, 0.05, Math.min(exit, length(sub(target, origin))))) return 'blocked';
    // A clear local patch is NOT assumed clear beyond its boundary. Missing
    // coverage is explicitly excluded from the accepted candidate set.
    for (let i = 0; i <= 32; i++) {
      const x = origin[0] + direction[0] * exit * i / 32, y = origin[1] + direction[1] * exit * i / 32, z = origin[2] + direction[2] * exit * i / 32;
      const lat = Math.atan2(z,Math.hypot(x,y))*180/Math.PI, lon=Math.atan2(y,x)*180/Math.PI;
      const g=this.grid, edgeLon=(g.east-g.west)/g.width, edgeLat=(g.north-g.south)/g.height;
      if (lon <= g.west+edgeLon || lon >= g.east-edgeLon || lat <= g.south+edgeLat || lat >= g.north-edgeLat) return 'unknown';
    }
    return 'clear';
  }
  dispose() { this.geometry.dispose(); }
}
