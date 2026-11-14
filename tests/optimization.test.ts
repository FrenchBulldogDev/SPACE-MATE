import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, DoubleSide, Ray, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { TerrainMask, lunarPoint, type TerrainGrid } from '../server/lunarTerrain';
import { dot, length, normalize, sub } from '../src/science/vectors';
import type { Vec3 } from '../src/science/types';
import { SAMPLE_MS, surfaceTimeline, surfaceVisibility, summarizeVisibility, type SurfaceTimeline, type SkySample } from '../server/landingSimulation';
import { indexVisibility } from '../server/visibilityIndex';

// Frozen pre-optimization mesh/ray algorithm. This deliberately uses the old
// allocations, eight-triangle leaves and all 33 coverage probes as an oracle.
function referenceTerrain(grid: TerrainGrid, lat: number, lon: number) {
  const anchor = lunarPoint(lat, lon), vertices: number[] = [], indices: number[] = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
    const latitude = grid.north - (y + .5) / grid.height * (grid.north - grid.south);
    const longitude = grid.west + (x + .5) / grid.width * (grid.east - grid.west);
    vertices.push(...sub(lunarPoint(latitude, longitude, grid.heights[y * grid.width + x]), anchor));
    if (x && y) { const i = y * grid.width + x; indices.push(i, i - 1, i - grid.width, i - 1, i - grid.width - 1, i - grid.width); }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices);
  const bvh = new MeshBVH(geometry, { targetLeafSize: 8 });
  return {
    geometry,
    lineOfSight(origin: Vec3, target: Vec3) {
      const direction = normalize(sub(target, origin)), r = length(origin), b = dot(origin, direction);
      const inner = 1737400 - 20000, discInner = b*b - r*r + inner*inner;
      if (b < 0 && discInner > 0) return 'blocked';
      const exit = -b + Math.sqrt(Math.max(0, b*b - r*r + (1737400 + 20000)**2));
      const ray = new Ray(new Vector3(...sub(origin, anchor)), new Vector3(...direction));
      if (bvh.raycastFirst(ray, DoubleSide, .05, Math.min(exit, length(sub(target, origin))))) return 'blocked';
      for (let i = 0; i <= 32; i++) {
        const p = origin.map((v,k) => v + direction[k] * exit * i / 32) as Vec3;
        const latitude = Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI, longitude = Math.atan2(p[1],p[0])*180/Math.PI;
        const edgeLon=(grid.east-grid.west)/grid.width, edgeLat=(grid.north-grid.south)/grid.height;
        if (longitude <= grid.west+edgeLon || longitude >= grid.east-edgeLon || latitude <= grid.south+edgeLat || latitude >= grid.north-edgeLat) return 'unknown';
      }
      return 'clear';
    },
  };
}

const terrain = (lat=0,lon=0): TerrainGrid => ({ width: 67, height: 39, west: lon-2, east: lon+2, south: lat-2, north: lat+2, source: 'regression fixture', fetchedAt: 'test', heights: Array.from({length:67*39},(_,i)=>Math.sin(i*.51)*600+Math.cos(i*.13)*1200) });

test('Optimized terrain preserves every Float32 vertex, triangle count and reference ray classification', () => {
  for (const [lat, lon] of [[0,0], [65,95], [-80,-170]]) {
    const grid = terrain(lat,lon), mask = new TerrainMask(grid,lat,lon), reference = referenceTerrain(grid,lat,lon);
    assert.deepEqual(mask.geometry.getAttribute('position').array, reference.geometry.getAttribute('position').array);
    assert.equal(mask.geometry.index!.count, reference.geometry.index!.count);
    const triangles=(geometry:BufferGeometry)=>{
      const a=geometry.index!.array, result:string[]=[];
      for(let i=0;i<a.length;i+=3)result.push(`${a[i]},${a[i+1]},${a[i+2]}`);
      return result.sort();
    };
    assert.deepEqual(triangles(mask.geometry),triangles(reference.geometry));
    try {
      for (let k=0;k<600;k++) {
        const origin=mask.surface(lat+Math.sin(k)*.25,lon+Math.cos(k)*.25,2);
        const target=lunarPoint(Math.sin(k*.87)*89, Math.cos(k*.17)*180,4e8);
        assert.equal(mask.lineOfSight(origin,target),reference.lineOfSight(origin,target),`ray ${lat},${lon},${k}`);
      }
    } finally { mask.dispose(); reference.geometry.dispose(); }
  }
});

test('Refitting a different lunar patch cannot mutate another patch sharing grid topology',()=>{
  const grid:TerrainGrid={width:65,height:65,west:-2,east:2,south:-2,north:2,source:'test',fetchedAt:'test',heights:Array.from({length:65*65},(_,i)=>i%65===34?5000:0)};
  const first=new TerrainMask(grid,0,0),origin=first.surface(0,0,2),angle=20*Math.PI/180;
  const target:Vec3=[origin[0]+4e8*Math.sin(angle),origin[1]+4e8*Math.cos(angle),origin[2]];
  assert.equal(first.lineOfSight(origin,target),'blocked');
  const second=new TerrainMask({...grid,west:88,east:92,south:63,north:67,heights:grid.heights.map(()=>0)},65,90);
  try{assert.equal(first.lineOfSight(origin,target),'blocked');}
  finally{first.dispose();second.dispose();}
});

test('Visibility prefix index matches cycle scans with fractional boundaries, interruptions and unknown samples', () => {
  let seed=12345;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  const timeline: SurfaceTimeline=Array.from({length:60*48+1},(_,i)=>({time:i*SAMPLE_MS,communication:random()>.02,sunlight:random()>.03,communicationUnknown:random()<.005,sunlightUnknown:random()<.005}));
  const compare=(series: SurfaceTimeline)=>{
    const indexed=indexVisibility(series);
    for(let i=0;i<100;i++)for(const key of ['communication','sunlight'] as const){
      const arrival=(i/100)*30*86400000+123456.789;
      const expected=summarizeVisibility(series,arrival,key),actual=indexed(arrival,key);
      assert.equal(actual.fullCycleClear,expected.fullCycleClear);
      for(const field of ['continuousHours','visiblePercent','checkedHours','uncertaintyMinutes'] as const)assert.ok(Math.abs(actual[field]-expected[field])<1e-8,`${key}.${field}`);
    }
    assert.throws(()=>indexed(59*86400000,'communication'));
  };
  compare(timeline);
  compare(timeline.map(s=>({...s,communication:true,sunlight:true,communicationUnknown:false,sunlightUnknown:false})));
});

test('Lazy joint-window rejection matches full ray traces and never promotes unknown coverage', () => {
  const mask=new TerrainMask(terrain(),0,0);
  const sky: SkySample[]=Array.from({length:60*48+1},(_,i)=>({time:i*SAMPLE_MS,earth:lunarPoint(0,Math.sin(i*.003)*65,4e8),sun:lunarPoint(0,i/48*360/29.5,1.5e11)}));
  try {
    const full=surfaceTimeline(mask,0,0,sky),lazy=surfaceVisibility(mask,0,0,sky);
    for(let day=0;day<30;day++){
      const arrival=day*86400000+123456.789;
      const expected=Math.min(summarizeVisibility(full,arrival,'communication').continuousHours,summarizeVisibility(full,arrival,'sunlight').continuousHours)>24.5;
      assert.equal(lazy.hasJointWindow(arrival),expected);
    }
    assert.deepEqual(lazy.timeline(),full);
    const dark=surfaceVisibility(mask,0,0,sky.map(s=>({...s,sun:[-1.5e11,0,0]})));
    for(let day=0;day<30;day++)assert.equal(dark.hasJointWindow(day*86400000),false);
    assert.ok(dark.sampled<=30,`Rejected points used ${dark.sampled} samples rather than ${sky.length}`);
  } finally { mask.dispose(); }
});
