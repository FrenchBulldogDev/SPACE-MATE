import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fromArrayBuffer } from 'geotiff';
import { BufferGeometry, Float32BufferAttribute, DoubleSide, Ray, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Vec3 } from '../src/science/types';
import { dot, length, normalize, sub } from '../src/science/vectors';

export const TREK_DEM = 'https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer';
export const lunarPoint = (lat: number, lon: number, height = 0): Vec3 => {
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180, r = 1737400 + height;
  return [r * Math.cos(p) * Math.cos(l), r * Math.cos(p) * Math.sin(l), r * Math.sin(p)];
};
export type TerrainGrid = { width: number; height: number; west: number; east: number; south: number; north: number; heights: number[]; source: string; fetchedAt: string };

export async function loadTerrain(latitude: number, longitude: number): Promise<TerrainGrid> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 88 || Math.abs(longitude) > 178.8) throw new Error('Unsupported local DEM extent');
  const bbox = [longitude - 2, latitude - 2, longitude + 2, latitude + 2];
  // 4° / 512 ≈ 237 m north-south, ~2x the native 256 ppd global LOLA DEM.
  const params = new URLSearchParams({ f: 'image', bbox: bbox.join(','), bboxSR: '104903', imageSR: '104903', size: '512,512', pixelType: 'F32', format: 'tiff', interpolation: 'RSP_NearestNeighbor', adjustAspectRatio: 'false', renderingRule: JSON.stringify({rasterFunction:'None'}) });
  const source = `${TREK_DEM}/exportImage?${params}`;
  const id = createHash('sha256').update(source).digest('hex').slice(0, 24), file = `data/terrain/${id}.json`;
  try { return JSON.parse(await readFile(file, 'utf8')); } catch {}
  // Stream the TIFF directly. The service's JSON href points to an internal
  // /arcgis output path which is not reachable through Trek's public proxy.
  const image = await fetch(source, { signal: AbortSignal.timeout(90000) });
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
  constructor(public grid: TerrainGrid, latitude: number, longitude: number) {
    if(grid.width<3||grid.height<3||grid.heights.length!==grid.width*grid.height||grid.heights.some(h=>!Number.isFinite(h)||Math.abs(h)>15000))throw new Error('Invalid or incomplete numeric DEM');
    this.anchor = lunarPoint(latitude, longitude);
    this.resolutionMeters = 1737400 * Math.PI / 180 * Math.max((grid.east - grid.west) / grid.width, (grid.north - grid.south) / grid.height);
    const vertices: number[] = [], indices: number[] = [];
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
      const lat = grid.north - (y + 0.5) / grid.height * (grid.north - grid.south), lon = grid.west + (x + 0.5) / grid.width * (grid.east - grid.west);
      vertices.push(...sub(lunarPoint(lat, lon, grid.heights[y * grid.width + x]), this.anchor));
      if (x && y) { const i = y * grid.width + x; indices.push(i, i - 1, i - grid.width, i - 1, i - grid.width - 1, i - grid.width); }
    }
    this.geometry = new BufferGeometry(); this.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); this.geometry.setIndex(indices);
    this.bvh = new MeshBVH(this.geometry, { targetLeafSize: 8 });
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
    const ray = new Ray(new Vector3(...sub(origin, this.anchor)), new Vector3(...direction));
    if (this.bvh.raycastFirst(ray, DoubleSide, 0.05, Math.min(exit, length(sub(target, origin))))) return 'blocked';
    // A clear local patch is NOT assumed clear beyond its boundary. Missing
    // coverage is explicitly excluded from the accepted candidate set.
    for (let i = 0; i <= 32; i++) {
      const point = origin.map((v,k) => v + direction[k] * exit * i / 32) as Vec3;
      const lat = Math.atan2(point[2],Math.hypot(point[0],point[1]))*180/Math.PI, lon=Math.atan2(point[1],point[0])*180/Math.PI;
      const g=this.grid, edgeLon=(g.east-g.west)/g.width, edgeLat=(g.north-g.south)/g.height;
      if (lon <= g.west+edgeLon || lon >= g.east-edgeLon || lat <= g.south+edgeLat || lat >= g.north-edgeLat) return 'unknown';
    }
    return 'clear';
  }
  dispose() { this.geometry.dispose(); }
}
