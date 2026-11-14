import { hermiteCoefficients, evaluateHermite } from '../src/science/ephemeris';
import { FLIGHT_HISTORY } from '../src/science/flightHistory';
import { geodeticPosition, inBasis, length, sub, terrestrialBasis, dot } from '../src/science/vectors';
import type { Vec3 } from '../src/science/types';
import { jplStates } from './jplStates';

export const LUNAR_CYCLE_SECONDS = 27.321661 * 86400;
const environments = new Map<number, ReturnType<typeof acquireLunarEnvironment>>();
export function loadLunarEnvironment(start: number) {
  if (!environments.has(start)) { const promise = acquireLunarEnvironment(start); environments.set(start,promise); void promise.catch(()=>environments.delete(start)); }
  return environments.get(start)!;
}
async function acquireLunarEnvironment(start: number) {
  const step = 1800000, times = Array.from({ length: 56 * 48 + 1 }, (_, i) => start + i * step);
  const earth = await jplStates('399', '500@301', times);
  const sun = await jplStates('10', '500@301', times);
  const greenwich = await jplStates('g:0,0,0@301', '500@301', times);
  const north = await jplStates('g:0,90,0@301', '500@301', times);
  const at = (time: number) => {
    if (time < times[0] || time > times[times.length - 1]) throw new Error('Lunar environment does not cover this instant');
    const i = Math.min(times.length - 2, Math.floor((time - start) / step)), u = (time - times[i]) / step;
    const state = (table: typeof earth) => evaluateHermite(hermiteCoefficients(table.states[i], table.states[i + 1], step / 1000), u, step / 1000);
    const basis = terrestrialBasis(state(greenwich), state(north));
    const toBody = (v: Vec3): Vec3 => [dot(v, basis.x.position), dot(v, basis.y.position), dot(v, basis.z.position)];
    return { earth: toBody(state(earth).position), sun: toBody(state(sun).position), earthIcrf: state(earth).position, basis };
  };
  return { at, start, stop: times[times.length - 1], attitudes: times.map((time,i)=>({time,greenwich:greenwich.states[i],northPole:north.states[i]})), queries: [earth.url, sun.url, greenwich.url, north.url] };
}

export async function flightReferences() {
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
