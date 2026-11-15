import type { TerrainMask } from './lunarTerrain';
import type { SkySample, SurfaceTimeline } from './landingSimulation';
import { cross, dot, length, normalize, sub } from '../src/science/vectors';
import { LUNAR_CYCLE_SECONDS } from './lunarEnvironment';

const AU_METERS = 149597870700; // IAU astronomical unit, exact SI definition.
export function indexSolarEnergy(mask: TerrainMask, latitude: number, longitude: number, sky: SkySample[], timeline: SurfaceTimeline) {
  if (sky.length !== timeline.length || sky.length < 2 || sky.some((s, i) => s.time !== timeline[i].time || i > 0 && s.time <= sky[i - 1].time)) throw Error('Mismatched solar geometry and visibility');
  const origin = mask.surface(latitude, longitude, 2);
  const east = sub(mask.surface(latitude, longitude + 0.01, 2), mask.surface(latitude, longitude - 0.01, 2));
  const north = sub(mask.surface(latitude + 0.01, longitude, 2), mask.surface(latitude - 0.01, longitude, 2));
  const normal = normalize(cross(east, north));
  const incidence = sky.map(s => {
    const direction = sub(s.sun, origin), distance = length(direction);
    if (!Number.isFinite(distance) || distance <= 0) throw Error('Invalid Sun ephemeris');
    return Math.max(0, dot(normal, normalize(direction))) * (AU_METERS / distance) ** 2;
  });
  const known = new Float64Array(sky.length), possible = new Float64Array(sky.length), unknown = new Float64Array(sky.length);
  const interval = (i: number, start: number, stop: number) => {
    const a = timeline[i], b = timeline[i + 1], dt = sky[i + 1].time - sky[i].time;
    const x = (start - a.time) / dt, y = (stop - a.time) / dt;
    const energy = (incidence[i] * (y - x) + (incidence[i + 1] - incidence[i]) * (y * y - x * x) / 2) * dt / 3600000;
    const clear = a.sunlight && b.sunlight && !a.sunlightUnknown && !b.sunlightUnknown;
    const unresolved = a.sunlightUnknown || b.sunlightUnknown;
    return [clear ? energy : 0, clear || unresolved ? energy : 0, unresolved ? (stop - start) / 3600000 : 0];
  };
  for (let i = 0; i + 1 < sky.length; i++) {
    const v = interval(i, sky[i].time, sky[i + 1].time);
    known[i + 1] = known[i] + v[0]; possible[i + 1] = possible[i] + v[1]; unknown[i + 1] = unknown[i] + v[2];
  }
  const prefixAt = (time: number) => {
    if (!Number.isFinite(time) || time < sky[0].time || time > sky.at(-1)!.time) throw Error('Solar energy requires complete time coverage');
    let low = 0, high = sky.length - 1;
    while (low + 1 < high) { const mid = (low + high) >>> 1; if (sky[mid].time <= time) low = mid; else high = mid; }
    const v = interval(low, sky[low].time, time);
    return [known[low] + v[0], possible[low] + v[1], unknown[low] + v[2]];
  };
  return (arrival: number) => {
    const a = prefixAt(arrival), b = prefixAt(arrival + LUNAR_CYCLE_SECONDS * 1000);
    return { equivalentSunHours: Math.max(0, b[0] - a[0]), possibleSunHours: Math.max(0, b[1] - a[1]),
      unknownHours: Math.max(0, b[2] - a[2]), durationHours: LUNAR_CYCLE_SECONDS / 3600 };
  };
}
