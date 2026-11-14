import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { spherical, validateEphemeris } from '../src/science/ephemeris';
import type { Ephemeris, StateVector, Vec3 } from '../src/science/types';
import { serializeJpl } from './jplQueue';

const endpoint = 'https://ssd.jpl.nasa.gov/api/horizons.api';
export const CACHE_DIRECTORY = path.resolve('data/horizons');
const STEP_SECONDS = 300;
const DURATION_MS = 28 * 86400000;
const pending = new Map<string, Promise<Ephemeris>>();

export function horizonsParameters(start: number, command: string): URLSearchParams {
  const values: Record<string, string> = {
    COMMAND: command, CENTER: '500@399', MAKE_EPHEM: 'YES', OBJ_DATA: 'NO',
    EPHEM_TYPE: 'VECTORS', REF_SYSTEM: 'ICRF', REF_PLANE: 'FRAME',
    TIME_TYPE: 'UT', OUT_UNITS: 'KM-S', VEC_TABLE: '2', VEC_CORR: 'NONE',
    START_TIME: new Date(start).toISOString().slice(0, 19).replace('T', ' '),
    STOP_TIME: new Date(start + DURATION_MS).toISOString().slice(0, 19).replace('T', ' '),
    STEP_SIZE: '5 m', CSV_FORMAT: 'YES', TIME_DIGITS: 'FRACSEC', CAL_TYPE: 'GREGORIAN',
  };
  return new URLSearchParams({ format: 'json', ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, `'${value}'`])) });
}

export function parseVectors(result: string, start: number, expectedCount = 8065): StateVector[] {
  if (!/Center body name:\s*Earth\s*\(399\)/.test(result) || !/ICRF/.test(result) || !/Output units\s*:\s*KM-S/.test(result)) throw new Error('Horizons returned the wrong coordinate center, frame or units');
  const block = result.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!block) throw new Error('Horizons returned no state-vector table');
  const lines = block.trim().split(/\r?\n/);
  if (lines.length !== expectedCount) throw new Error(`Incomplete Horizons table: ${lines.length}/${expectedCount}`);
  return lines.map((line, index) => {
    const fields = line.split(',').map(field => field.trim());
    const jd = Number(fields[0]);
    const expectedJd = (start + index * STEP_SECONDS * 1000) / 86400000 + 2440587.5;
    const values = fields.slice(2, 8).map(value => Number(value.replace(/D/gi, 'E')) * 1000);
    if (Math.abs(jd - expectedJd) * 86400 > 0.01 || !Number.isFinite(jd) || values.length !== 6 || !values.every(Number.isFinite) || !fields[1].includes('A.D.')) throw new Error('Invalid or misaligned UTC Horizons row');
    return { position: values.slice(0, 3) as Vec3, velocity: values.slice(3, 6) as Vec3 };
  });
}

async function query(start: number, command: string) {
  const url = `${endpoint}?${horizonsParameters(start, command)}`;
  // JPL asks clients to serialize requests. A fixed target/center whitelist
  // prevents this endpoint from becoming an arbitrary proxy.
  const work = serializeJpl(async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Horizons HTTP ${response.status}`);
    const payload = await response.json() as { result?: string; error?: string; signature?: { source?: string; version?: string } };
    if (payload.error || !payload.result) throw new Error(`Horizons: ${payload.error || 'empty response'}`);
    return { url, raw: payload.result, states: parseVectors(payload.result, start) };
  });
  return work;
}

export async function loadEphemeris(startISO: string, refresh = false): Promise<Ephemeris> {
  const start = Date.parse(startISO);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(startISO) || !Number.isFinite(start) || new Date(start).toISOString() !== startISO || start < Date.parse('1962-01-20') || start + DURATION_MS > Date.parse('2101-01-01')) throw new Error('Invalid start time: use UTC minute precision between 1962-01-20 and 2100-12-03');
  const id = createHash('sha256').update(`v1-icrf-utc-5m-${startISO}`).digest('hex').slice(0, 24);
  const filename = path.join(CACHE_DIRECTORY, `${id}.json`);
  if (!refresh) {
    try { const saved: unknown = JSON.parse(await readFile(filename, 'utf8')); validateEphemeris(saved); return saved; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('Ignoring invalid ephemeris cache:', (error as Error).message); }
  }
  if (pending.has(id)) return pending.get(id)!;
  const task = (async () => {
    // Surface targets share the geocentric observer. Their ICRF states encode
    // JPL's full terrestrial orientation/EOP, rather than an assumed GMST.
    const moon = await query(start, '301');
    const greenwich = await query(start, 'g:0,0,0@399');
    const northPole = await query(start, 'g:0,90,0@399');
    const points = moon.states.map((state, i) => ({ time: start + i * STEP_SECONDS * 1000, moon: state, greenwich: greenwich.states[i], northPole: northPole.states[i], spherical: spherical(state.position) }));
    const data: Ephemeris = {
      version: 1, id, source: 'NASA/JPL Horizons', frame: 'ICRF', center: '500@399', corrections: 'NONE', timeScale: 'UTC',
      start, stop: start + DURATION_MS, stepSeconds: STEP_SECONDS, fetchedAt: new Date().toISOString(),
      queries: [moon.url, greenwich.url, northPole.url], points, daily: points.filter((_, i) => i % 288 === 0),
    };
    validateEphemeris(data);
    await mkdir(CACHE_DIRECTORY, { recursive: true });
    for (const [label, raw] of [['moon', moon.raw], ['greenwich', greenwich.raw], ['north-pole', northPole.raw]]) await writeFile(path.join(CACHE_DIRECTORY, `${id}-${label}.txt`), raw, 'utf8');
    const temporary = `${filename}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(data), 'utf8');
    await rename(temporary, filename);
    return data;
  })();
  pending.set(id, task);
  try { return await task; } finally { pending.delete(id); }
}

export function horizonsMiddleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
  const url = new URL(request.url || '/', 'http://localhost');
  if (url.pathname === '/api/ephemeris/latest') {
    response.setHeader('Content-Type','application/json');
    if(request.method!=='GET'){response.writeHead(405).end();return;}
    void latestEphemeris(url.searchParams.get('refresh')==='1').then(data=>response.end(JSON.stringify(data))).catch(()=>response.writeHead(502).end(JSON.stringify({error:'JPL unavailable'})));return;
  }
  if (url.pathname !== '/api/ephemeris') { next(); return; }
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') { response.writeHead(405).end(JSON.stringify({ error: 'GET required' })); return; }
  const start = url.searchParams.get('start') || '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(start) || !Number.isFinite(Date.parse(start)) || Date.parse(start) < Date.parse('1962-01-20') || Date.parse(start) + DURATION_MS > Date.parse('2101-01-01')) { response.writeHead(400).end(JSON.stringify({ error: 'Invalid UTC start time' })); return; }
  void loadEphemeris(start, url.searchParams.get('refresh') === '1').then(data => response.end(JSON.stringify(data))).catch((error: Error) => {
    console.error('Ephemeris acquisition failed:', error.message);
    response.writeHead(502).end(JSON.stringify({ error: 'Horizons is unavailable or its response failed validation. Retry; no synthetic orbit will be used for calculations.' }));
  });
}

export async function latestEphemeris(refresh=false):Promise<Ephemeris>{
  const now=new Date();now.setUTCSeconds(0,0);
  if(!refresh){
    const list:Ephemeris[]=[];
    for(const filename of await readdir(CACHE_DIRECTORY).catch(()=>[])) if(/^[a-f0-9]{24}\.json$/.test(filename)){
      try{const value:unknown=JSON.parse(await readFile(path.join(CACHE_DIRECTORY,filename),'utf8'));validateEphemeris(value);if(value.start<=now.getTime()&&value.stop>now.getTime()+27*86400000)list.push(value);}catch{}
    }
    list.sort((a,b)=>b.start-a.start);if(list[0])return list[0];
  }
  return loadEphemeris(now.toISOString(),refresh);
}

export function horizonsPlugin(): Plugin {
  return { name: 'jpl-horizons', configureServer(server) { server.middlewares.use(horizonsMiddleware); }, configurePreviewServer(server) { server.middlewares.use(horizonsMiddleware); } };
}
