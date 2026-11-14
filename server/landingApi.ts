import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { LAUNCH_SITES, type LaunchSite } from '../src/config';
import { validateEphemeris } from '../src/science/ephemeris';
import { landingJobId, landingJobs, runLandingAnalysis } from './landingAnalysis';
import { loadLunarEnvironment } from './lunarEnvironment';

export function landingMiddleware(req:IncomingMessage,res:ServerResponse,next:()=>void){
  const url=new URL(req.url||'/','http://localhost');
  if(!['/api/landing-analysis','/api/lunar-frames'].includes(url.pathname)){next();return;}
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  void (async()=>{
    const dataId=url.searchParams.get('ephemeris')||'';
    if(!/^[a-f0-9]{24}$/.test(dataId))throw new Error('Invalid ephemeris ID');
    const data:unknown=JSON.parse(await readFile(`data/horizons/${dataId}.json`,'utf8'));validateEphemeris(data);
    if(url.pathname==='/api/lunar-frames'){res.end(JSON.stringify((await loadLunarEnvironment(data.start)).attitudes));return;}
    let site:LaunchSite|undefined=LAUNCH_SITES.find(s=>s.id===url.searchParams.get('site'));
    if(url.searchParams.get('site')==='custom'){
      const latitude=Number(url.searchParams.get('lat')),longitude=Number(url.searchParams.get('lon')),heightMeters=Number(url.searchParams.get('h')||'0');
      if(!url.searchParams.has('lat')||!url.searchParams.has('lon')||![latitude,longitude,heightMeters].every(Number.isFinite)||Math.abs(latitude)>90||Math.abs(longitude)>180||heightMeters < -500||heightMeters>10000)throw new Error('Invalid custom site');
      site={id:'custom',name:'Custom site',region:'Custom',latitude,longitude,heightMeters};
    }
    if(!site)throw new Error('Select a launch site');
    const id=landingJobId(data,site);
    if(url.searchParams.get('retry')==='1'&&landingJobs.get(id)?.status==='error')landingJobs.delete(id);
    if(!landingJobs.has(id)){
      try{const report=JSON.parse(await readFile(`data/landing/report-${id}.json`,'utf8'));landingJobs.set(id,{id,status:'complete',completed:report.processed,total:report.searched,stage:'complete',report});}
      catch{
        const running=[...landingJobs.values()].some(j=>j.status==='running');
        if(running){res.writeHead(202).end(JSON.stringify({id,status:'running',completed:0,total:0,stage:'queued'}));return;}
        void runLandingAnalysis(data,site).catch(error=>console.error('Landing analysis:',String(error)));
      }
    }
    res.end(JSON.stringify(landingJobs.get(id)??{id,status:'running',completed:0,total:0,stage:'ephemerides'}));
  })().catch(error=>{console.error(String(error));res.writeHead(400).end(JSON.stringify({error:'Landing analysis request failed'}));});
}
export const landingPlugin=():Plugin=>({name:'lunar-landing',configureServer(server){server.middlewares.use(landingMiddleware);},configurePreviewServer(server){server.middlewares.use(landingMiddleware);}});
