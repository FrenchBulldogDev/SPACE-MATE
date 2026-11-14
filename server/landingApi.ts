import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { LAUNCH_SITES, type LaunchSite } from '../src/config';
import { validateEphemeris } from '../src/science/ephemeris';
import { landingJobId, landingJobs, runLandingAnalysis } from './landingAnalysis';
import { loadLunarEnvironment, LUNAR_CYCLE_SECONDS } from './lunarEnvironment';
import { transientEphemeris, transientSignal } from './monthlyEphemeris';

const subscribers = new Map<string, { id: string; touched: number }>();
const cancelled = new Map<string, number>();
const controllers = new Map<string, AbortController>();
const active = new Set<string>();

export function releaseLandingRequest(token: string) {
  cancelled.set(token, Date.now());
  const subscription = subscribers.get(token); subscribers.delete(token);
  if (subscription && ![...subscribers.values()].some(s => s.id === subscription.id)) {
    controllers.get(subscription.id)?.abort(); controllers.delete(subscription.id);
    landingJobs.delete(subscription.id);
  }
}

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [token, s] of subscribers) if (now - s.touched > 10 * 60000) releaseLandingRequest(token);
  for (const [token, time] of cancelled) if (now - time > 10 * 60000) cancelled.delete(token);
}, 60000); sweep.unref();

export function landingMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!['/api/landing-analysis', '/api/lunar-frames'].includes(url.pathname)) { next(); return; }
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  const token = url.searchParams.get('request') || '';
  if (req.method === 'DELETE' && url.pathname === '/api/landing-analysis') {
    if (!/^[a-f0-9-]{36}$/.test(token)) { res.writeHead(400).end(); return; }
    releaseLandingRequest(token); res.writeHead(204).end(); return;
  }
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  void (async () => {
    if (token && cancelled.has(token)) { res.writeHead(410).end(); return; }
    const dataId = url.searchParams.get('ephemeris') || '';
    if (!/^[a-f0-9]{24}$/.test(dataId)) throw new Error('Invalid ephemeris ID');
    let data = transientEphemeris(dataId);
    if (!data) {
      const saved: unknown = JSON.parse(await readFile(`data/horizons/${dataId}.json`, 'utf8'));
      validateEphemeris(saved); data = saved;
    }
    const monthSignal = transientSignal(dataId);
    if (url.pathname === '/api/lunar-frames') {
      res.end(JSON.stringify((await loadLunarEnvironment(data.start, data.arrivalMonth ? data.stop + LUNAR_CYCLE_SECONDS * 1000 : undefined, { signal: monthSignal, persist: !data.arrivalMonth, cacheKey: data.arrivalMonth ? data.id : undefined })).attitudes)); return;
    }
    if (data.arrivalMonth && !/^[a-f0-9-]{36}$/.test(token)) throw new Error('Monthly analysis needs a request token');
    if (cancelled.has(token)) { res.writeHead(410).end(); return; }
    let site: LaunchSite | undefined = LAUNCH_SITES.find(s => s.id === url.searchParams.get('site'));
    if (url.searchParams.get('site') === 'custom') {
      const latitude = Number(url.searchParams.get('lat')), longitude = Number(url.searchParams.get('lon')), heightMeters = Number(url.searchParams.get('h') || '0');
      if (!url.searchParams.has('lat') || !url.searchParams.has('lon') || ![latitude, longitude, heightMeters].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || heightMeters < -500 || heightMeters > 10000) throw new Error('Invalid custom site');
      site = { id: 'custom', name: 'Custom site', region: 'Custom', latitude, longitude, heightMeters };
    }
    if (!site) throw new Error('Select a launch site');
    const id = landingJobId(data, site);
    if (token) subscribers.set(token, { id, touched: Date.now() });
    if (url.searchParams.get('retry') === '1' && landingJobs.get(id)?.status === 'error') landingJobs.delete(id);
    if (!landingJobs.has(id)) {
      let saved = false;
      if (!data.arrivalMonth) try {
        const report = JSON.parse(await readFile(`data/landing/report-${id}.json`, 'utf8'));
        landingJobs.set(id, { id, status: 'complete', completed: report.processed, total: report.searched, stage: 'complete', report }); saved = true;
      } catch {}
      if (!saved) {
        if (active.size) { res.writeHead(202).end(JSON.stringify({ id, status: 'running', completed: 0, total: 0, stage: 'queued' })); return; }
        const controller = new AbortController(); controllers.set(id, controller); active.add(id);
        const signal = monthSignal ? AbortSignal.any([controller.signal, monthSignal]) : controller.signal;
        void runLandingAnalysis(data, site, 10, signal, monthSignal).catch(error => {
          if (!signal.aborted) console.error('Landing analysis:', String(error));
        }).finally(() => { active.delete(id); if (controllers.get(id) === controller) controllers.delete(id); });
      }
    }
    res.end(JSON.stringify(landingJobs.get(id) ?? { id, status: 'running', completed: 0, total: 0, stage: 'ephemerides' }));
  })().catch(error => { if (!res.destroyed) { console.error(String(error)); res.writeHead(400).end(JSON.stringify({ error: 'Landing analysis request failed' })); } });
}
export const landingPlugin = (): Plugin => ({ name: 'lunar-landing', configureServer(server) { server.middlewares.use(landingMiddleware); }, configurePreviewServer(server) { server.middlewares.use(landingMiddleware); } });
