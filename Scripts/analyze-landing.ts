import { readFile } from 'node:fs/promises';
import { runLandingAnalysis, landingJobs } from '../server/landingAnalysis';
import { LAUNCH_SITES } from '../src/config';
import { validateEphemeris } from '../src/science/ephemeris';
import { latestEphemeris } from '../server/horizons';
const requested=process.argv.find(a=>/^[a-f0-9]{24}$/.test(a));
const data:unknown=requested?JSON.parse(await readFile(`data/horizons/${requested}.json`,'utf8')):await latestEphemeris();
validateEphemeris(data);
const timer=setInterval(()=>{for(const j of landingJobs.values())console.log(JSON.stringify({id:j.id,status:j.status,stage:j.stage,completed:j.completed,total:j.total}));},15000);
try{
  const report=await runLandingAnalysis(data,LAUNCH_SITES[0],process.argv.includes('--smoke')?90:10);
  console.log(JSON.stringify({id:report.id,searched:report.searched,processed:report.processed,candidates:report.candidates.length,unverified:report.unverified,days:[...new Set(report.candidates.map(c=>new Date(c.arrival).toISOString().slice(0,10)))]}));
}finally{clearInterval(timer);}
