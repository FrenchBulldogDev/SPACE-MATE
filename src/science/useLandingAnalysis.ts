import { useEffect, useState } from 'react';
import type { LaunchSite } from '../config';
import type { Ephemeris } from './types';
import type { LandingJob } from './landingTypes';

export function useLandingAnalysis(data: Ephemeris | null, site: LaunchSite | null) {
  const key = JSON.stringify([data?.id, data?.fetchedAt, site?.id, site?.latitude, site?.longitude, site?.heightMeters]);
  const [state, setState] = useState<{ key: string; retry: number; job: LandingJob | null }>(), [retry, setRetry] = useState(0);
  useEffect(() => {
    setState(undefined);
    if (!data || !site) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController(), request = crypto.randomUUID();
    const params = new URLSearchParams({ ephemeris: data.id, site: site.id, request });
    if (retry) params.set('retry', '1');
    if (site.id === 'custom') { params.set('lat', String(site.latitude)); params.set('lon', String(site.longitude)); params.set('h', String(site.heightMeters ?? 0)); }
    const endpoint = `/api/landing-analysis?${params}`;
    const poll = async () => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw Error('Analysis unavailable');
        const job: LandingJob = await response.json(); if (!active) return;
        if (job.report && job.report.arrivalMonth !== data.arrivalMonth) throw Error('Wrong arrival month');
        setState({ key, retry, job }); if (job.status === 'running') timer = setTimeout(poll, 2000);
      } catch { if (active) setState({ key, retry, job: { id: 'error', status: 'error', completed: 0, total: 0, stage: 'error' } }); }
    };
    void poll();
    const release = () => { void fetch(endpoint, { method: 'DELETE', keepalive: true }).catch(() => {}); };
    window.addEventListener('pagehide', release);
    return () => { active = false; controller.abort(); clearTimeout(timer); window.removeEventListener('pagehide', release); release(); };
  }, [key, retry]);
  return { job: state?.key === key && state.retry === retry ? state.job : null, retry: () => setRetry(n => n + 1) };
}

export function useLunarAttitudes(data: Ephemeris | null) {
  const key = data ? `${data.id}:${data.fetchedAt}` : '';
  const [state, setState] = useState<{ key: string; generation: number; attitudes?: Ephemeris['lunarAttitudes']; status: 'loading' | 'ready' | 'error' }>();
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    setState(undefined);
    if (!data) return;
    let active = true; const controller = new AbortController();
    void fetch(`/api/lunar-frames?ephemeris=${data.id}`, { signal: controller.signal }).then(async r => {
      if (!r.ok) throw Error(); const attitudes = await r.json();
      if (!Array.isArray(attitudes) || attitudes.length < 2 || attitudes[0].time > data.start || attitudes[attitudes.length - 1].time < data.stop) throw Error();
      if (active) setState({ key, generation, attitudes, status: 'ready' });
    }).catch(() => { if (active) setState({ key, generation, status: 'error' }); });
    return () => { active = false; controller.abort(); };
  }, [key, generation]);
  const current = state?.key === key && state.generation === generation;
  return { attitudes: current ? state.attitudes : undefined, status: current ? state.status : 'loading' as const, retry: () => setGeneration(n => n + 1) };
}
