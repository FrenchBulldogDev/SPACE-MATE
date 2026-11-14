import { useEffect, useState } from 'react';
import type { LaunchSite } from '../config';
import type { Ephemeris } from './types';
import type { LandingJob } from './landingTypes';

export function useLandingAnalysis(data:Ephemeris|null,site:LaunchSite|null){
  const [job,setJob]=useState<LandingJob|null>(null),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>;
    setJob(null);if(!data||!site)return;
    const params=new URLSearchParams({ephemeris:data.id,site:site.id});
    if(retry)params.set('retry','1');
    if(site.id==='custom'){params.set('lat',String(site.latitude));params.set('lon',String(site.longitude));params.set('h',String(site.heightMeters??0));}
    const poll=async()=>{
      try{const response=await fetch(`/api/landing-analysis?${params}`);if(!response.ok)throw Error('Analysis unavailable');const next:LandingJob=await response.json();if(!active)return;setJob(next);if(next.status==='running')timer=setTimeout(poll,2000);}
      catch{if(active)setJob({id:'error',status:'error',completed:0,total:0,stage:'error'});}
    };void poll();return()=>{active=false;clearTimeout(timer);};
  },[data?.id,site?.id,site?.latitude,site?.longitude,site?.heightMeters,retry]);
  return{job,retry:()=>setRetry(n=>n+1)};
}

export function useLunarAttitudes(data:Ephemeris|null){
  const [attitudes,setAttitudes]=useState<Ephemeris['lunarAttitudes']>();
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[generation,setGeneration]=useState(0);
  useEffect(()=>{let active=true;setAttitudes(undefined);setStatus('loading');if(!data)return;void fetch(`/api/lunar-frames?ephemeris=${data.id}`).then(async r=>{if(!r.ok)throw Error();const frames=await r.json();if(!Array.isArray(frames)||frames.length<2||frames[0].time>data.start||frames[frames.length-1].time<data.stop)throw Error();if(active){setAttitudes(frames);setStatus('ready');}}).catch(()=>{if(active)setStatus('error');});return()=>{active=false;};},[data?.id,generation]);
  return {attitudes,status,retry:()=>setGeneration(n=>n+1)};
}
