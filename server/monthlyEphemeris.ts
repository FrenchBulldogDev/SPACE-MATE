import { createHash } from 'node:crypto';
import { open, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { monthBounds } from '../src/science/calendar';
import { interpolateEphemeris, spherical, validateEphemeris } from '../src/science/ephemeris';
import type { Ephemeris, EphemerisPoint } from '../src/science/types';
import { CACHE_DIRECTORY, query } from './horizons';

const STEP = 300000;
type Entry = { key: string; month: string; controller: AbortController; promise: Promise<Ephemeris>; data?: Ephemeris; users: Set<string> };
const entries = new Map<string, Entry>();
const leases = new Map<string, { entry: Entry; touched: number }>();
const cancelled = new Map<string, number>();
let handoff: Ephemeris | undefined;
let handoffTimer: ReturnType<typeof setTimeout> | undefined;

// Regrid only INSIDE verified coverage using the existing Hermite interpolator.
// A different five-minute phase in an old dataset does not force a re-download.
export function reuseSamples(source: Ephemeris, start: number, points: (EphemerisPoint | undefined)[]) {
  for (let i = 0; i < points.length; i++) {
    const time = start + i * STEP;
    if (!points[i] && time >= source.start && time <= source.stop) points[i] = interpolateEphemeris(source, time);
  }
}

export function missingSpans(points: (EphemerisPoint | undefined)[]) {
  const spans: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i]) continue;
    const first = i;
    while (i + 1 < points.length && !points[i + 1]) i++;
    // A single missing epoch still needs a two-row Horizons table.
    spans.push(first === i ? [Math.max(0, first - 1), Math.min(points.length - 1, i + 1)] : [first, i]);
  }
  return spans;
}

async function cacheCanFill(filename: string, start: number, points: (EphemerisPoint | undefined)[]) {
  // Generated datasets put coverage metadata before the large state tables.
  // Read just that header to skip irrelevant or already-covered originals.
  // Unknown layouts fall back to full parsing and scientific validation.
  const handle = await open(filename, 'r');
  try {
    const buffer = Buffer.allocUnsafe(4096), { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.toString('utf8', 0, bytesRead).split('"points"')[0];
    const a = /"start"\s*:\s*(-?\d+)/.exec(header), b = /"stop"\s*:\s*(-?\d+)/.exec(header);
    if (!a || !b) return true;
    const first = Number(a[1]), last = Number(b[1]);
    if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) return true;
    for (let i = Math.max(0, Math.ceil((first - start) / STEP)); i < points.length && start + i * STEP <= last; i++) if (!points[i]) return true;
    return false;
  } finally { await handle.close(); }
}

export async function acquireMonthlyEphemeris(month: string, signal: AbortSignal, refresh = false, key = month) {
  const bounds = monthBounds(month), start = bounds.departureStart, stop = bounds.stop;
  const points = Array<EphemerisPoint | undefined>((stop - start) / STEP + 1).fill(undefined);
  const queries = new Set<string>();
  const reuse = (data: Ephemeris) => {
    if (data.stop < start || data.start > stop) return;
    reuseSamples(data, start, points); data.queries.forEach(url => queries.add(url));
  };
  if (!refresh) {
    if (handoff) reuse(handoff);
    for (const entry of entries.values()) if (entry.data) reuse(entry.data);
    // Read one original dataset at a time. Never delete the user's source data.
    for (const filename of await readdir(CACHE_DIRECTORY).catch(() => [])) {
      signal.throwIfAborted();
      if (points.every(Boolean)) break;
      if (!/^[a-f0-9]{24}\.json$/.test(filename)) continue;
      try {
        const file = path.join(CACHE_DIRECTORY, filename);
        if (!await cacheCanFill(file, start, points)) continue;
        const data: unknown = JSON.parse(await readFile(file, 'utf8')); validateEphemeris(data); reuse(data);
      } catch {}
    }
  }
  for (const [first, last] of missingSpans(points)) {
    signal.throwIfAborted();
    const a = start + first * STEP, b = start + last * STEP;
    const moon = await query(a, '301', b, signal);
    const greenwich = await query(a, 'g:0,0,0@399', b, signal);
    const north = await query(a, 'g:0,90,0@399', b, signal);
    [moon.url, greenwich.url, north.url].forEach(url => queries.add(url));
    for (let i = first; i <= last; i++) {
      const k = i - first;
      points[i] ??= { time: start + i * STEP, moon: moon.states[k], greenwich: greenwich.states[k], northPole: north.states[k], spherical: spherical(moon.states[k].position) };
    }
  }
  signal.throwIfAborted();
  const data: Ephemeris = {
    version: 1, id: createHash('sha256').update(`monthly-v1-${key}`).digest('hex').slice(0, 24),
    source: 'NASA/JPL Horizons', frame: 'ICRF', center: '500@399', corrections: 'NONE', timeScale: 'UTC',
    start, stop, stepSeconds: 300, arrivalMonth: month, fetchedAt: new Date().toISOString(), queries: [...queries],
    points: points as EphemerisPoint[], daily: points.filter((_, i) => i % 288 === 0) as EphemerisPoint[],
  };
  validateEphemeris(data);
  handoff = undefined; clearTimeout(handoffTimer);
  // Monthly datasets and query intermediates are intentionally not written to disk.
  return data;
}

export function transientEphemeris(id: string) {
  for (const entry of entries.values()) if (entry.data?.id === id) return entry.data;
  return undefined;
}

export function transientSignal(id: string) {
  for (const entry of entries.values()) if (entry.data?.id === id) return entry.controller.signal;
  return undefined;
}

export function releaseMonthLease(token: string) {
  cancelled.set(token, Date.now());
  const lease = leases.get(token);
  if (!lease) return;
  leases.delete(token); lease.entry.users.delete(token);
  if (!lease.entry.users.size) {
    const entry = lease.entry;
    entry.controller.abort(); if (entries.get(entry.key) === entry) entries.delete(entry.key);
    // Keep at most one seed briefly, allowing a new month to reuse overlapping
    // states without retaining a chain of intervening months or years.
    if (entry.data) {
      handoff = entry.data; clearTimeout(handoffTimer);
      handoffTimer = setTimeout(() => { handoff = undefined; }, 60000); handoffTimer.unref();
    }
  }
}

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [token, lease] of leases) if (now - lease.touched > 10 * 60000) releaseMonthLease(token);
  for (const [token, time] of cancelled) if (now - time > 10 * 60000) cancelled.delete(token);
}, 60000); sweep.unref();

export function monthlyMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname !== '/api/ephemeris/month') { next(); return; }
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  const token = url.searchParams.get('lease') || '';
  if (!/^[a-f0-9-]{36}$/.test(token)) { res.writeHead(400).end(JSON.stringify({ error: 'Invalid lease' })); return; }
  if (req.method === 'DELETE') { releaseMonthLease(token); res.writeHead(204).end(); return; }
  if (req.method === 'POST') { const lease = leases.get(token); if (lease) lease.touched = Date.now(); res.writeHead(lease ? 204 : 410).end(); return; }
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  void (async () => {
    const month = url.searchParams.get('month') || ''; monthBounds(month);
    if (cancelled.has(token)) { res.writeHead(410).end(); return; }
    const refresh = url.searchParams.get('refresh') === '1';
    let entry = refresh ? undefined : [...entries.values()].find(e => e.month === month && !e.controller.signal.aborted);
    if (!entry) {
      const controller = new AbortController(), key = refresh ? `${month}:${token}` : month;
      entry = { key, month, controller, users: new Set(), promise: acquireMonthlyEphemeris(month, controller.signal, refresh, key) };
      entries.set(key, entry);
      const current = entry;
      void entry.promise.then(data => { current.data = data; }).catch(() => { if (entries.get(key) === current) entries.delete(key); });
    }
    entry.users.add(token); leases.set(token, { entry, touched: Date.now() });
    res.on('close', () => { if (!res.writableEnded) releaseMonthLease(token); });
    const data = await entry.promise;
    if (!res.destroyed) res.end(JSON.stringify(data));
  })().catch(error => { releaseMonthLease(token); if (!res.destroyed) res.writeHead(error instanceof RangeError ? 400 : 502).end(JSON.stringify({ error: 'Monthly JPL ephemeris unavailable' })); });
}

export const monthlyPlugin = (): Plugin => ({ name: 'monthly-ephemerides', configureServer(server) { server.middlewares.use(monthlyMiddleware); }, configurePreviewServer(server) { server.middlewares.use(monthlyMiddleware); } });
