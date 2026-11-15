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
import { SAMPLE_MS, surfaceVisibility, type SkySample } from './landingSimulation';
import { indexVisibility } from './visibilityIndex';
import { DAY_MS, LAUNCH_LOOKBACK_DAYS, monthBounds } from '../src/science/calendar';
import { LUNAR_CYCLE_SECONDS } from './lunarEnvironment';
import { indexSolarEnergy } from './solarEnergy';

export const landingJobs = new Map<string, LandingJob>();
export const landingJobId = (data: Ephemeris, site: LaunchSite, gridStep=10) => createHash('sha256').update(JSON.stringify({ version: data.arrivalMonth ? 4 : 3, ...(data.arrivalMonth ? { ephemeris: data.id } : {}), start: data.start, stop: data.stop, latitude: site.latitude, longitude: site.longitude, h: site.heightMeters ?? 0, gridStep })).digest('hex').slice(0, 24);

export async function runLandingAnalysis(data: Ephemeris, launchSite: LaunchSite, gridStep = 10, signal?: AbortSignal, environmentSignal = signal): Promise<LandingReport> {
  const id = landingJobId(data, launchSite,gridStep), filename = `data/landing/report-${id}.json`;
  signal?.throwIfAborted();
  if (!data.arrivalMonth) try { const saved = JSON.parse(await readFile(filename,'utf8')) as LandingReport; landingJobs.set(id,{id,status:'complete',completed:saved.processed,total:saved.searched,stage:'complete',report:saved}); return saved; } catch {}
  if (landingJobs.get(id)?.status === 'running') throw new Error('Analysis is already running');
  const job: LandingJob = {id,status:'running',completed:0,total:0,stage:'ephemerides'}; landingJobs.set(id,job);
  const bounds = data.arrivalMonth ? monthBounds(data.arrivalMonth) : null;
  const report: LandingReport = { version:1,id,status:'estimated',start:bounds?.start??data.start,stop:bounds?.stop??data.stop,arrivalMonth:data.arrivalMonth,candidates:[],coarseSpacingDegrees:gridStep,temporalStepMinutes:30,processed:0,excluded:0,unverified:0,searched:0,historyIds:[],createdAt:new Date().toISOString(),limitations:[
    'Empirical launch-to-landing interpolation is not a solved transfer trajectory or a statistical confidence interval.',
    'The 10-degree global grid and local refinements are sampled locations, not an exhaustive certification of every point on the Moon.',
    'Ray tests use a ~237-m DEM. Unresolved terrain, antenna link budget, Earth ground-station scheduling and electrical power budgets are not certified.',
    'Direct Earth-center geometric visibility only; no relay model. Missing terrain coverage is excluded.',
    'Temporal uncertainty is at least ±30 minutes; shorter interruptions and unresolved relief are not bounded by that number.',
    'Solar visibility and incidence indicate potential generation; no battery, panel efficiency or load assumptions are invented.',
    'Solar potential integrates max(0,n·s)(1 au/r)^2 over the same sidereal cycle. Equivalent irradiation hours are not electrical kWh. Conservative sampled visibility excludes low Sun below 1 degree and partial eclipses; unresolved rays have separate bounds. No measured time-dependent solar irradiance is assumed.',
  ] };
  try {
    const env = await loadLunarEnvironment(data.start, data.arrivalMonth ? data.stop + LUNAR_CYCLE_SECONDS * 1000 : undefined, { signal: environmentSignal, persist: !data.arrivalMonth, cacheKey: data.arrivalMonth ? data.id : undefined });
    signal?.throwIfAborted();
    const references = (await flightReferences()).filter(f => f.profile === 'direct'); report.historyIds=references.map(f=>f.id);
    signal?.throwIfAborted();
    // Validated lunar states are <500 Mm from Earth. Include both surface
    // offsets; fail explicitly if the empirical model outgrows our lookback.
    if (bounds && empiricalFlightTimes(510000000, references).centerSeconds * 1000 > LAUNCH_LOOKBACK_DAYS * DAY_MS) throw new Error('Historical flight model exceeds departure coverage');
    const opportunities = findProximityMinima(data,launchSite).minima.filter(p=>p.aboveHorizon);
    // Launch-site positions do not depend on the lunar landing point.
    const departures = opportunities.map(launch => ({ time: launch.time, position: siteState(data, launch.time, launchSite).position }));
    const sky: SkySample[]=[];
    for(let t=bounds?.start??env.start;t<=env.stop;t+=SAMPLE_MS){ const s=env.at(t); sky.push({time:t,earth:s.earth,sun:s.sun}); }
    const earthDirections = sky.map(s => normalize(s.earth));
    const grid: LunarSite[]=[];
    for(let lat=-85;lat<90;lat+=gridStep) for(let lon=-175;lon<180;lon+=gridStep) grid.push({id:`grid-${lat}-${lon}`,latitude:lat,longitude:lon});
    for(const f of FLIGHT_HISTORY) grid.push({id:f.id,latitude:f.latitude,longitude:f.longitude,name:f.id});
    report.searched=grid.length; job.total=grid.length; job.stage='terrain';
    for(const center of grid){
      signal?.throwIfAborted();
      const radial=normalize(lunarPoint(center.latitude,center.longitude));
      // Global geometric prefilter only: uncertain near-horizon sectors are
      // still submitted to the terrain test rather than called clear.
      if(!earthDirections.some(direction=>dot(radial,direction)>0.01)){report.excluded++;report.processed++;job.completed++;continue;}
      let mask:TerrainMask|null=null;
      try{
        const terrain=await loadTerrain(center.latitude,center.longitude,signal); signal?.throwIfAborted(); mask=new TerrainMask(terrain,center.latitude,center.longitude);
        const refinements=[center,...[[0.25,0],[-0.25,0],[0,0.25],[0,-0.25]].map(([a,b],i)=>({id:`${center.id}-r${i}`,latitude:center.latitude+a,longitude:center.longitude+b}))];
        for(const site of refinements){
          const visibility=surfaceVisibility(mask,site.latitude,site.longitude,sky);
          let summarize: ReturnType<typeof indexVisibility> | undefined;
          let solarEnergy: ReturnType<typeof indexSolarEnergy> | undefined;
          const local=lunarPoint(site.latitude,site.longitude);
          for(const launch of departures){
            const earthSite=launch.position;
            let arrival=launch.time+4.3*86400000, estimate:ReturnType<typeof empiricalFlightTimes>|null=null;
            for(let k=0;k<8;k++){
              if(arrival>data.stop)break;
              const s=env.at(arrival);
              const offset=inBasis(local,s.basis).position;
              // Earth-comoving geometric separation proxy. It uses both
              // surface coordinates and the Moon's actual arrival position.
              const target=s.earthIcrf.map((v,i)=>-v+offset[i]) as Vec3;
              estimate=empiricalFlightTimes(length(sub(target,earthSite)),references);
              const next=launch.time+estimate.centerSeconds*1000;
              if(Math.abs(next-arrival)<1000){arrival=next;break;} arrival=next;
            }
            if(!estimate||arrival<report.start||(bounds?arrival>=report.stop:arrival>report.stop))continue;
            if(!visibility.hasJointWindow(arrival))continue;
            if (!summarize) {
              const timeline = visibility.timeline();
              summarize = indexVisibility(timeline);
              solarEnergy = indexSolarEnergy(mask, site.latitude, site.longitude, sky, timeline);
            }
            const communication=summarize(arrival,'communication'),sunlight=summarize(arrival,'sunlight');
            const jointHours=Math.min(communication.continuousHours,sunlight.continuousHours);
            if(jointHours<=24+0.5)continue;
            report.candidates.push({site,launch:launch.time,arrival,flightHours:estimate.centerSeconds/3600,flightMarginHours:estimate.marginSeconds/3600,communication,sunlight,jointHours,solarEnergy:solarEnergy!(arrival),terrainResolutionMeters:mask.resolutionMeters,terrainSource:terrain.source});
          }
        }
      }catch(error){signal?.throwIfAborted();report.unverified++; if (!bounds) { await mkdir('data/landing',{recursive:true}); await writeFile(`data/landing/excluded-${id}-${center.id.replace(/[^a-z0-9-]/gi,'_')}.txt`,String(error)); }}
      finally{mask?.dispose();}
      report.processed++;job.completed=report.processed;
      // Yield between sectors so HTTP progress requests remain responsive.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    report.candidates.sort((a,b)=>a.arrival-b.arrival||b.jointHours-a.jointHours);
    signal?.throwIfAborted();
    if (!bounds) { await mkdir('data/landing',{recursive:true});await writeFile(filename,JSON.stringify(report)); }
    job.status='complete';job.stage='complete';job.report=report;return report;
  }catch(error){job.status='error';job.error=String(error);throw error;}
}
