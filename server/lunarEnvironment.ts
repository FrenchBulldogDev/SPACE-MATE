import { hermiteCoefficients, evaluateHermite } from '../src/science/ephemeris';
import { FLIGHT_HISTORY } from '../src/science/flightHistory';
import { geodeticPosition, inBasis, length, sub, terrestrialBasis, dot } from '../src/science/vectors';
import type { Vec3 } from '../src/science/types';
import { jplStates } from './jplStates';

export const LUNAR_CYCLE_SECONDS = 27.321661 * 86400;
const environments = new Map<string, ReturnType<typeof acquireLunarEnvironment>>();
export function loadLunarEnvironment(start: number, stop = start + 56 * 86400000, options: { signal?: AbortSignal; persist?: boolean; cacheKey?: string } = {}) {
  const key = `${start}:${stop}:${options.cacheKey??''}`;
  if (!environments.has(key)) {
    const promise = acquireLunarEnvironment(start, stop, options); environments.set(key,promise);
    const remove = () => { if (environments.get(key) === promise) environments.delete(key); };
    void promise.catch(remove); options.signal?.addEventListener('abort', remove, { once: true });
    // Legacy command-line requests also have a bounded in-memory cache.
    while (environments.size > 2) environments.delete(environments.keys().next().value!);
  }
  return environments.get(key)!;
}
async function acquireLunarEnvironment(start: number, stop: number, options: { signal?: AbortSignal; persist?: boolean }) {
  const step = 1800000, times = Array.from({ length: Math.ceil((stop - start) / step) + 1 }, (_, i) => start + i * step);
  const earth = await jplStates('399', '500@301', times, options);
  const sun = await jplStates('10', '500@301', times, options);
  const greenwich = await jplStates('g:0,0,0@301', '500@301', times, options);
  const north = await jplStates('g:0,90,0@301', '500@301', times, options);
  const prepare = (table: typeof earth) => {
    const coefficients: (ReturnType<typeof hermiteCoefficients> | undefined)[] = [];
    return (i: number, u: number) => {
      if (u === 0) return table.states[i];
      coefficients[i] ??= hermiteCoefficients(table.states[i], table.states[i + 1], step / 1000);
      return evaluateHermite(coefficients[i], u, step / 1000);
    };
  };
  const earthAt = prepare(earth), sunAt = prepare(sun), greenwichAt = prepare(greenwich), northAt = prepare(north);
  const at = (time: number) => {
    if (time < times[0] || time > times[times.length - 1]) throw new Error('Lunar environment does not cover this instant');
    const i = Math.min(times.length - 2, Math.floor((time - start) / step)), u = (time - times[i]) / step;
    const earthState = earthAt(i, u), sunState = sunAt(i, u);
    const basis = terrestrialBasis(greenwichAt(i, u), northAt(i, u));
    const toBody = (v: Vec3): Vec3 => [dot(v, basis.x.position), dot(v, basis.y.position), dot(v, basis.z.position)];
    return { earth: toBody(earthState.position), sun: toBody(sunState.position), earthIcrf: earthState.position, basis };
  };
  return { at, start, stop: times[times.length - 1], attitudes: times.map((time,i)=>({time,greenwich:greenwich.states[i],northPole:north.states[i]})), queries: [earth.url, sun.url, greenwich.url, north.url] };
}

let references: ReturnType<typeof acquireFlightReferences> | undefined;
export function flightReferences() {
  if (!references) { references = acquireFlightReferences(); void references.catch(() => { references = undefined; }); }
  return references;
}
async function acquireFlightReferences() {
  const times = FLIGHT_HISTORY.flatMap(f => [Date.parse(f.launch), Date.parse(f.landing)]).sort((a, b) => a - b);
  const moon = await jplStates('301', '500@399', times);
  const greenwich = await jplStates('g:0,0,0@399', '500@399', times);
  const north = await jplStates('g:0,90,0@399', '500@399', times);
  const moonX = await jplStates('g:0,0,0@301', '500@399', times);
  const moonZ = await jplStates('g:0,90,0@301', '500@399', times);
  return FLIGHT_HISTORY.map(f => {
    const a = times.indexOf(Date.parse(f.launch)), b = times.indexOf(Date.parse(f.landing));
    const earthSite = inBasis(geodeticPosition(f.launchLatitude, f.launchLongitude), terrestrialBasis(greenwich.states[a], north.states[a])).position;
    const relative = (table: typeof moonX) => ({ position: sub(table.states[b].position, moon.states[b].position), velocity: sub(table.states[b].velocity, moon.states[b].velocity) });
    const bodyBasis = terrestrialBasis(relative(moonX), relative(moonZ));
    const phi = f.latitude * Math.PI / 180, lambda = f.longitude * Math.PI / 180;
    const offset = inBasis([1737400 * Math.cos(phi) * Math.cos(lambda), 1737400 * Math.cos(phi) * Math.sin(lambda), 1737400 * Math.sin(phi)], bodyBasis).position;
    const target = moon.states[b].position.map((v, k) => v + offset[k]) as Vec3;
    return { ...f, distanceMeters: length(sub(target, earthSite)), elapsedSeconds: (Date.parse(f.landing) - Date.parse(f.launch)) / 1000 };
  });
}
