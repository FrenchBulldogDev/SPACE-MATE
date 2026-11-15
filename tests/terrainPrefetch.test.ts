import test from 'node:test';
import assert from 'node:assert/strict';
import { prefetchTerrain } from '../server/terrainPrefetch';
import type { TerrainGrid } from '../server/lunarTerrain';

const centers=Array.from({length:8},(_,i)=>({id:String(i),latitude:i,longitude:0}));
const terrain={source:'test'} as TerrainGrid;

test('Terrain prefetch keeps three requests in flight, original order and per-patch errors', async () => {
  let inFlight=0,maximum=0;
  const started:number[]=[],finished:number[]=[];
  const load=async(latitude:number)=>{
    started.push(latitude);inFlight++;maximum=Math.max(maximum,inFlight);
    await new Promise(resolve=>setTimeout(resolve,latitude===0?15:1));
    inFlight--;finished.push(latitude);
    if(latitude===2)throw Error('Missing DEM');
    return terrain;
  };
  const results=[];
  for await(const patch of prefetchTerrain(centers,undefined,load)) results.push(patch);
  assert.equal(maximum,3);assert.notEqual(finished[0],0);
  assert.deepEqual(started,[0,1,2,3,4,5,6,7]);
  assert.deepEqual(results.map(r=>r.center),centers);
  assert.ok('error' in results[2]);
  assert.ok(results.filter((_,i)=>i!==2).every(r=>'terrain' in r&&r.terrain===terrain));
});

test('Closing or cancelling terrain prefetch aborts pending requests and never starts later patches', async () => {
  for(const cancel of [false,true]){
    const controller=new AbortController(),started:number[]=[],signals:AbortSignal[]=[];
    const load=async(latitude:number,_longitude:number,signal?:AbortSignal)=>{
      started.push(latitude);signals.push(signal!);
      if(latitude===0)return terrain;
      return new Promise<TerrainGrid>((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));
    };
    const iterator=prefetchTerrain(centers,controller.signal,load);
    assert.equal((await iterator.next()).value!.center,centers[0]);
    if(cancel){controller.abort();await assert.rejects(iterator.next());}
    else await iterator.return(undefined);
    await Promise.resolve();
    assert.ok(signals.every(s=>s.aborted));
    assert.ok(started.length<=4);
    assert.ok(started.every(i=>i<4));
  }
});
