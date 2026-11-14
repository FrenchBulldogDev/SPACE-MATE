import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { bodyUV, sphericalUVs } from '../src/scene/bodyUV.ts';
import { surfaceDirection } from '../src/scene/math.ts';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { FLIGHT_HISTORY, empiricalFlightTimes } from '../src/science/flightHistory.ts';
import { TerrainMask, lunarPoint, type TerrainGrid } from '../server/lunarTerrain.ts';
import { summarizeVisibility, earthEclipsesSun, type SurfaceTimeline, SAMPLE_MS } from '../server/landingSimulation.ts';
import { LUNAR_CYCLE_SECONDS } from '../server/lunarEnvironment.ts';
import { candidateForArrivalDay, landingCalendarDays } from '../src/science/landingWindows.ts';

test('Moon texture is the verified NASA north-up, zero-longitude-centered LROC image',async()=>{
  const bytes=await readFile(new URL('../Assets/Moon Texture.jpg',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170');
  for(const [lat,lon] of [[0,0],[20,30],[-43.31,-11.36],[0,90],[0,-90]]){
    const p=surfaceDirection(lat,lon),uv=bodyUV(p.x,p.y,p.z);
    assert.ok(Math.abs(uv[0]-(lon+180)/360)<1e-12);
    assert.ok(Math.abs(uv[1]-(lat+90)/180)<1e-12);
  }
  const tycho=surfaceDirection(-43.31,-11.36),uv=bodyUV(tycho.x,tycho.y,tycho.z);
  assert.ok(Math.abs(uv[0]*2048-959.37)<0.1);
  assert.ok(Math.abs((1-uv[1])*1024-758.39)<0.1);
});

test('Polar triangles keep adjacent unwrapped UVs instead of streaking across the texture',()=>{
  const a=surfaceDirection(80,170),b=surfaceDirection(80,-170);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([a.x,a.y,a.z,b.x,b.y,b.z,0,1,0],3));sphericalUVs(g);
  const uv=g.getAttribute('uv');assert.ok(Math.abs(uv.getX(2)-(uv.getX(0)+uv.getX(1))/2)<1e-6);g.dispose();
});

test('Historical interpolation keeps direct flights separate from low-energy flights and exposes empirical scatter',()=>{
  assert.ok(FLIGHT_HISTORY.some(f=>f.nation==='USSR'));
  assert.ok(FLIGHT_HISTORY.some(f=>f.nation==='India'));
  assert.ok(FLIGHT_HISTORY.some(f=>f.nation==='Japan'));
  assert.ok(!FLIGHT_HISTORY.some(f=>f.nation==='China'));
  for(const f of FLIGHT_HISTORY)assert.ok(Date.parse(f.landing)>Date.parse(f.launch));
  const estimate=empiricalFlightTimes(400000000,[{distanceMeters:400000000,elapsedSeconds:4*86400},{distanceMeters:400000000,elapsedSeconds:6*86400}]);
  assert.equal(estimate.centerSeconds,5*86400);assert.equal(estimate.marginSeconds,86400);
  assert.throws(()=>empiricalFlightTimes(1,[]));
});

const grid=(wall=false):TerrainGrid=>({width:65,height:65,west:-2,east:2,south:-2,north:2,source:'synthetic test terrain',fetchedAt:'test',heights:Array.from({length:65*65},(_,i)=>wall&&i%65===34?5000:0)});
test('Backend rays exclude crater-wall blind sectors and never accept missing far-field coverage',()=>{
  const clear=new TerrainMask(grid(),0,0),wall=new TerrainMask(grid(true),0,0);
  const origin=clear.surface(0,0,2);
  const target=(degrees:number)=>{const a=degrees*Math.PI/180;return [origin[0]+4e8*Math.sin(a),origin[1]+4e8*Math.cos(a),origin[2]] as [number,number,number];};
  assert.equal(clear.lineOfSight(origin,target(70)),'clear');
  assert.equal(wall.lineOfSight(origin,target(20)),'blocked');
  assert.equal(clear.lineOfSight(origin,target(1)),'unknown');
  assert.equal(clear.lineOfSight(origin,[-4e8,0,0]),'blocked');
  clear.dispose();wall.dispose();
  const incomplete=grid();incomplete.heights[0]=NaN;assert.throws(()=>new TerrainMask(incomplete,0,0));
});

test('Communication runs stop at one lunar cycle and solar unknowns do not alter communication statistics',()=>{
  const timeline:SurfaceTimeline=Array.from({length:56*48+1},(_,i)=>({time:i*SAMPLE_MS,communication:true,sunlight:false,communicationUnknown:false,sunlightUnknown:true}));
  const comm=summarizeVisibility(timeline,123456,'communication');
  assert.equal(comm.fullCycleClear,true);assert.equal(comm.visiblePercent,100);assert.ok(Math.abs(comm.continuousHours-LUNAR_CYCLE_SECONDS/3600)<1e-9);
  assert.equal(summarizeVisibility(timeline,123456,'sunlight').continuousHours,0);
  timeline[10].communication=false;
  const interrupted=summarizeVisibility(timeline,0,'communication');assert.equal(interrupted.fullCycleClear,false);assert.equal(interrupted.continuousHours,4.5);assert.equal(interrupted.uncertaintyMinutes,30);
  assert.throws(()=>summarizeVisibility(timeline,55*86400000,'communication'));
});

test('The Earth can eclipse the Sun and no energy opportunity is inferred through its disk',()=>{
  assert.equal(earthEclipsesSun(lunarPoint(0,0),[4e8,0,0],[1.5e11,0,0]),true);
  assert.equal(earthEclipsesSun(lunarPoint(0,0),[0,4e8,0],[1.5e11,0,0]),false);
});

test('Non-contiguous arrival days are rejected by the calendar and submit predicate',()=>{
  const start=Date.parse('2026-11-14T12:00Z'),stop=start+28*86400000;
  const candidates=[{arrival:Date.parse('2026-11-19T18:00Z')},{arrival:Date.parse('2026-11-21T18:00Z')}];
  assert.equal(candidateForArrivalDay('2026-11-18',candidates),null);
  assert.equal(candidateForArrivalDay('2026-11-19',candidates),candidates[0]);
  assert.equal(candidateForArrivalDay('2026-11-20',candidates),null);
  assert.equal(candidateForArrivalDay('2026-02-30',candidates),null);
  assert.equal(candidateForArrivalDay('2026-11-19',[]),null);
  assert.equal(landingCalendarDays(start,stop).length,29);
});
