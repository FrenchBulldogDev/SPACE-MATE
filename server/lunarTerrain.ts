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
export type Sight = 'clear' | 'blocked' | 'unknown';
// Relief beyond the local patch. `shellMeters` is a height above the 1737.4-km
// sphere that no lunar terrain reaches; `lineOfSight` classifies the part of a
// ray between `near` and `far` metres from its Moon-fixed origin.
export type FarField = { shellMeters: number; lineOfSight(origin: Vec3, direction: Vec3, near: number, far: number): Sight };

// A patch of roughly fixed size on the ground. A fixed ±2° of longitude would
// shrink east-west from 61 km at the equator to 5 km at 85°, so the longitude
// span widens by 1/cos(latitude). Below ~26° the difference is under 10% and
// the original ±2° request is kept, which also reuses existing downloads.
export function terrainExtent(latitude: number, longitude: number): [number, number, number, number] {
  const cosine = Math.cos(latitude * Math.PI / 180);
  const half = cosine > 0.9 ? 2 : Math.max(2, Math.min(2 / cosine, 60, 180 - Math.abs(longitude)));
  return [longitude - half, latitude - 2, longitude + half, latitude + 2];
}

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
  const bbox = terrainExtent(latitude, longitude);
  // 4° / 512 ≈ 237 m north-south, ~2x the native 256 ppd global LOLA DEM. The
  // widened longitude span keeps east-west pixels at about the same size.
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
  private readonly coverageAxis: Vec3;
  private readonly coverageCosine: number;
  // Without `farField` a ray that leaves this patch below the outer shell is
  // 'unknown'. With it, the remainder of the ray is tested against global relief.
  constructor(public grid: TerrainGrid, latitude: number, longitude: number, private readonly farField?: FarField) {
    if(grid.width<3||grid.height<3||grid.heights.length!==grid.width*grid.height||grid.heights.some(h=>!Number.isFinite(h)||Math.abs(h)>15000))throw new Error('Invalid or incomplete numeric DEM');
    this.anchor = lunarPoint(latitude, longitude);
    const middleLat = (grid.north + grid.south) / 2, middleLon = (grid.east + grid.west) / 2;
    this.coverageAxis = normalize(lunarPoint(middleLat, middleLon));
    const halfLat = ((grid.north - grid.south) / 2 - (grid.north - grid.south) / grid.height) * Math.PI / 180;
    const halfLon = ((grid.east - grid.west) / 2 - (grid.east - grid.west) / grid.width) * Math.PI / 180;
    // A circular cone strictly INSIDE the existing geographic coverage. The
    // distance to either meridian is asin(cos(latitude) * sin(half longitude)).
    // A 1e-8-radian inward guard (~17 mm) is only a fast-path margin: anything
    // near an edge still runs the original 33 probes and 16 handover bisections.
    const angle = Math.min(halfLat, Math.asin(Math.cos(middleLat * Math.PI / 180) * Math.sin(halfLon))) - 1e-8;
    this.coverageCosine = halfLon > 0 && halfLon < Math.PI / 2 && angle > 0 ? Math.cos(angle) : Infinity;
    // Ground size of a pixel: a degree of longitude is shorter by cos(latitude).
    this.resolutionMeters = 1737400 * Math.PI / 180 * Math.max((grid.east - grid.west) / grid.width * Math.cos(latitude * Math.PI / 180), (grid.north - grid.south) / grid.height);
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
    // Interpolate on the same two triangles the rays are tested against (each
    // pixel quad is split along its bottom-left / top-right diagonal). Bilinear
    // interpolation differs from them wherever the quad is twisted, and could
    // place a site several metres underneath the mesh, blocking every ray.
    const h = u + v <= 1
      ? at(ix,iy) + u*(at(ix+1,iy)-at(ix,iy)) + v*(at(ix,iy+1)-at(ix,iy))
      : at(ix+1,iy+1) + (1-u)*(at(ix,iy+1)-at(ix+1,iy+1)) + (1-v)*(at(ix+1,iy)-at(ix+1,iy+1));
    return lunarPoint(latitude, longitude, h + height);
  }
  lineOfSight(origin: Vec3, target: Vec3): Sight {
    const direction = normalize(sub(target, origin)), r = length(origin), b = dot(origin, direction);
    // Any ray crossing a conservative inner solid sphere is blocked regardless
    // of local DEM coverage. The outer shell bounds potentially blocking relief:
    // the measured global maximum when far-field relief is available, otherwise
    // a fixed 20 km.
    const inner = 1737400 - 20000, discInner = b*b - r*r + inner*inner;
    if (b < 0 && discInner > 0) return 'blocked';
    const exit = -b + Math.sqrt(Math.max(0, b*b - r*r + (1737400 + (this.farField?.shellMeters ?? 20000))**2));
    const limit = Math.min(exit, length(sub(target, origin)));
    const ray = this.ray;
    ray.origin.set(origin[0] - this.anchor[0], origin[1] - this.anchor[1], origin[2] - this.anchor[2]);
    ray.direction.set(direction[0], direction[1], direction[2]);
    if (this.bvh.raycastFirst(ray, DoubleSide, 0.05, limit)) return 'blocked';
    // A cone with aperture <90° is convex. If both ends of the ray segment
    // are strictly inside it, all 33 original coverage probes are inside too.
    // This proves coverage only; the identical terrain intersection above is
    // always performed, including rays from the dark side or below the ground.
    const end: Vec3 = [origin[0] + direction[0] * exit, origin[1] + direction[1] * exit, origin[2] + direction[2] * exit];
    if (dot(origin, this.coverageAxis) > r * this.coverageCosine
      && dot(end, this.coverageAxis) > length(end) * this.coverageCosine) return 'clear';
    // A clear local patch is NOT assumed clear beyond its boundary.
    const g=this.grid, edgeLon=(g.east-g.west)/g.width, edgeLat=(g.north-g.south)/g.height;
    const outside = (distance: number) => {
      const x = origin[0] + direction[0] * distance, y = origin[1] + direction[1] * distance, z = origin[2] + direction[2] * distance;
      const lat = Math.atan2(z,Math.hypot(x,y))*180/Math.PI, lon=Math.atan2(y,x)*180/Math.PI;
      return lon <= g.west+edgeLon || lon >= g.east-edgeLon || lat <= g.south+edgeLat || lat >= g.north-edgeLat;
    };
    for (let i = 0; i <= 32; i++) {
      if (!outside(exit * i / 32)) continue;
      // Missing coverage is explicitly excluded from the accepted candidate set.
      if (!this.farField) return 'unknown';
      // Locate where the ray leaves the patch interior (still half a pixel
      // inside the mesh, so the two tests overlap) and hand over the rest.
      let inside = i ? exit * (i - 1) / 32 : 0, beyond = exit * i / 32;
      for (let k = 0; k < 16 && i; k++) { const middle = (inside + beyond) / 2; if (outside(middle)) beyond = middle; else inside = middle; }
      return inside >= limit ? 'clear' : this.farField.lineOfSight(origin, direction, Math.max(0.05, inside), limit);
    }
    return 'clear';
  }
  dispose() { this.geometry.dispose(); }
}
