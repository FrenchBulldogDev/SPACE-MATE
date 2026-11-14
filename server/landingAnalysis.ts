import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import type { LaunchSite } from '../src/config';
import type { Ephemeris, Vec3 } from '../src/science/types';
import type { LandingJob, LandingReport, LunarSite } from '../src/science/landingTypes';
import { FLIGHT_HISTORY, empiricalFlightTimes } from '../src/science/flightHistory';
import { findProximityMinima, siteState } from '../src/science/windows';
import { inBasis, length, sub, normalize, dot } from '../src/science/vectors';
import { flightReferences, loadLunarEnvironment } from './lunarEnvironment';
import { loadTerrain, TerrainMask, lunarPoint } from './lunarTerrain';
import { SAMPLE_MS, surfaceTimeline, summarizeVisibility, type SkySample } from './landingSimulation';

export const landingJobs = new Map<string, LandingJob>();
export const landingJobId = (data: Ephemeris, site: LaunchSite, gridStep=10) => createHash('sha256').update(JSON.stringify({ version: 1, start: data.start, stop: data.stop, latitude: site.latitude, longitude: site.longitude, h: site.heightMeters ?? 0, gridStep })).digest('hex').slice(0, 24);

export async function runLandingAnalysis(data: Ephemeris, launchSite: LaunchSite, gridStep = 10): Promise<LandingReport> {
  const id = landingJobId(data, launchSite,gridStep), filename = `data/landing/report-${id}.json`;
  try { const saved = JSON.parse(await readFile(filename,'utf8')) as LandingReport; landingJobs.set(id,{id,status:'complete',completed:saved.processed,total:saved.searched,stage:'complete',report:saved}); return saved; } catch {}
  if (landingJobs.get(id)?.status === 'running') throw new Error('Analysis is already running');
  const job: LandingJob = {id,status:'running',completed:0,total:0,stage:'ephemerides'}; landingJobs.set(id,job);
  const report: LandingReport = { version:1,id,status:'estimated',start:data.start,stop:data.stop,candidates:[],coarseSpacingDegrees:gridStep,temporalStepMinutes:30,processed:0,excluded:0,unverified:0,searched:0,historyIds:[],createdAt:new Date().toISOString(),limitations:[
    'Empirical launch-to-landing interpolation is not a solved transfer trajectory or a statistical confidence interval.',
    'The 10-degree global grid and local refinements are sampled locations, not an exhaustive certification of every point on the Moon.',
    'Ray tests use a ~237-m DEM. Unresolved terrain, antenna link budget, Earth ground-station scheduling and electrical power budgets are not certified.',
    'Direct Earth-center geometric visibility only; no relay model. Missing terrain coverage is excluded.',
    'Temporal uncertainty is at least ±30 minutes; shorter interruptions and unresolved relief are not bounded by that number.',
    'Solar visibility and incidence indicate potential generation; no battery, panel efficiency or load assumptions are invented.',
  ] };
  try {
    const env = await loadLunarEnvironment(data.start);
    const references = (await flightReferences()).filter(f => f.profile === 'direct'); report.historyIds=references.map(f=>f.id);
    const opportunities = findProximityMinima(data,launchSite).minima.filter(p=>p.aboveHorizon);
    const sky: SkySample[]=[];
    for(let t=env.start;t<=env.stop;t+=SAMPLE_MS){ const s=env.at(t); sky.push({time:t,earth:s.earth,sun:s.sun}); }
    const grid: LunarSite[]=[];
    for(let lat=-85;lat<90;lat+=gridStep) for(let lon=-175;lon<180;lon+=gridStep) grid.push({id:`grid-${lat}-${lon}`,latitude:lat,longitude:lon});
    for(const f of FLIGHT_HISTORY) grid.push({id:f.id,latitude:f.latitude,longitude:f.longitude,name:f.id});
    report.searched=grid.length; job.total=grid.length; job.stage='terrain';
    for(const center of grid){
      const radial=normalize(lunarPoint(center.latitude,center.longitude));
      // Global geometric prefilter only: uncertain near-horizon sectors are
      // still submitted to the terrain test rather than called clear.
      if(!sky.some(s=>dot(radial,normalize(s.earth))>0.01)){report.excluded++;report.processed++;job.completed++;continue;}
      let mask:TerrainMask|null=null;
      try{
        const terrain=await loadTerrain(center.latitude,center.longitude); mask=new TerrainMask(terrain,center.latitude,center.longitude);
        const refinements=[center,...[[0.25,0],[-0.25,0],[0,0.25],[0,-0.25]].map(([a,b],i)=>({id:`${center.id}-r${i}`,latitude:center.latitude+a,longitude:center.longitude+b}))];
        for(const site of refinements){
          const timeline=surfaceTimeline(mask,site.latitude,site.longitude,sky);
          for(const launch of opportunities){
            const earthSite=siteState(data,launch.time,launchSite).position;
            let arrival=launch.time+4.3*86400000, estimate:ReturnType<typeof empiricalFlightTimes>|null=null;
            for(let k=0;k<8;k++){
              if(arrival>data.stop)break;
              const s=env.at(arrival), local=lunarPoint(site.latitude,site.longitude);
              const offset=inBasis(local,s.basis).position;
              // Earth-comoving geometric separation proxy. It uses both
              // surface coordinates and the Moon's actual arrival position.
              const target=s.earthIcrf.map((v,i)=>-v+offset[i]) as Vec3;
              estimate=empiricalFlightTimes(length(sub(target,earthSite)),references);
              const next=launch.time+estimate.centerSeconds*1000;
              if(Math.abs(next-arrival)<1000){arrival=next;break;} arrival=next;
            }
            if(!estimate||arrival<data.start||arrival>data.stop)continue;
            const communication=summarizeVisibility(timeline,arrival,'communication'),sunlight=summarizeVisibility(timeline,arrival,'sunlight');
            const jointHours=Math.min(communication.continuousHours,sunlight.continuousHours);
            if(jointHours<=24+0.5)continue;
            report.candidates.push({site,launch:launch.time,arrival,flightHours:estimate.centerSeconds/3600,flightMarginHours:estimate.marginSeconds/3600,communication,sunlight,jointHours,terrainResolutionMeters:mask.resolutionMeters,terrainSource:terrain.source});
          }
        }
      }catch(error){report.unverified++; await mkdir('data/landing',{recursive:true}); await writeFile(`data/landing/excluded-${id}-${center.id.replace(/[^a-z0-9-]/gi,'_')}.txt`,String(error));}
      finally{mask?.dispose();}
      report.processed++;job.completed=report.processed;
      // Yield between sectors so HTTP progress requests remain responsive.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    report.candidates.sort((a,b)=>a.arrival-b.arrival||b.jointHours-a.jointHours);
    await mkdir('data/landing',{recursive:true});await writeFile(filename,JSON.stringify(report));
    job.status='complete';job.stage='complete';job.report=report;return report;
  }catch(error){job.status='error';job.error=String(error);throw error;}
}
