import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Session } from 'node:inspector/promises';
import { runLandingAnalysis, landingJobs } from '../server/landingAnalysis';
import { LAUNCH_SITES } from '../src/config';
import { validateEphemeris } from '../src/science/ephemeris';
import { latestEphemeris } from '../server/horizons';
import { acquireMonthlyEphemeris } from '../server/monthlyEphemeris';
import assert from 'node:assert/strict';
import { monthBounds } from '../src/science/calendar';
const requested=process.argv.find(a=>/^[a-f0-9]{24}$/.test(a));
const month=process.argv.find(a=>a.startsWith('--month='))?.slice(8);
const benchmark=process.argv.find(a=>a.startsWith('--benchmark='))?.slice(12);
const compare=process.argv.find(a=>a.startsWith('--compare='))?.slice(10);
if(benchmark&&!/^[a-z0-9-]+$/.test(benchmark))throw new Error('Invalid benchmark name');
if(compare&&!/^[a-z0-9-]+$/.test(compare))throw new Error('Invalid comparison name');
const controller=new AbortController();
const data:unknown=month?await acquireMonthlyEphemeris(month,controller.signal):requested?JSON.parse(await readFile(`data/horizons/${requested}.json`,'utf8')):await latestEphemeris();
validateEphemeris(data);
const timer=setInterval(()=>{for(const j of landingJobs.values())console.log(JSON.stringify({id:j.id,status:j.status,stage:j.stage,completed:j.completed,total:j.total}));},15000);
try{
  const profiler=benchmark?new Session():null;
  if(profiler){profiler.connect();await profiler.post('Profiler.enable');await profiler.post('Profiler.start');}
  const started=performance.now();
  const report=await runLandingAnalysis(data,LAUNCH_SITES[0],process.argv.includes('--smoke')?90:10,controller.signal);
  const elapsedMs=performance.now()-started;
  if(month){
    const bounds=monthBounds(month);
    assert.equal(report.start,bounds.start);assert.equal(report.stop,bounds.stop);
    assert.equal(report.processed,report.searched);
    for(const c of report.candidates){
      assert.ok(c.arrival>=bounds.start&&c.arrival<bounds.stop);
      assert.ok(c.launch<c.arrival&&c.launch>=data.start);
      assert.ok(c.communication.checkedHours>655&&c.sunlight.checkedHours>655);
      assert.ok(c.jointHours>24.5);
      assert.ok(c.solarEnergy, 'New reports require a solar incidence integral');
      assert.ok(Number.isFinite(c.solarEnergy.equivalentSunHours));
      assert.ok(c.solarEnergy.equivalentSunHours >= 0 && c.solarEnergy.possibleSunHours >= c.solarEnergy.equivalentSunHours - 1e-8);
      assert.ok(c.solarEnergy.unknownHours >= 0 && c.solarEnergy.unknownHours <= c.solarEnergy.durationHours + 1e-8);
    }
  }
  if(benchmark){
    const folder='artifacts/performance';await mkdir(folder,{recursive:true});
    const {profile}=await profiler!.post('Profiler.stop');profiler!.disconnect();
    await writeFile(`${folder}/${benchmark}.cpuprofile`,JSON.stringify(profile));
    const hash=createHash('sha256').update(JSON.stringify(report.candidates)).digest('hex');
    await writeFile(`${folder}/${benchmark}.json`,JSON.stringify({elapsedMs,hash,report}));
    console.log(JSON.stringify({benchmark,elapsedMs,hash}));
  }
  if(compare){
    const previous=JSON.parse(await readFile(`artifacts/performance/${compare}.json`,'utf8'));
    assert.deepEqual(report.candidates,previous.report.candidates);
    for(const key of ['searched','processed','excluded','unverified','historyIds','start','stop'] as const)assert.deepEqual(report[key],previous.report[key]);
    console.log(JSON.stringify({comparison:compare,identicalCandidates:true,speedup:previous.elapsedMs/elapsedMs}));
  }
  const solar = report.candidates.flatMap(c => c.solarEnergy ? [c.solarEnergy.equivalentSunHours] : []);
  console.log(JSON.stringify({id:report.id,searched:report.searched,processed:report.processed,candidates:report.candidates.length,unverified:report.unverified,solarEvaluated:solar.length,minimumEquivalentSunHours:solar.length?Math.min(...solar):null,maximumEquivalentSunHours:solar.length?Math.max(...solar):null,days:[...new Set(report.candidates.map(c=>new Date(c.arrival).toISOString().slice(0,10)))]}));
}finally{clearInterval(timer);controller.abort();}
