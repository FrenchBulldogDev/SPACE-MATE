import type { Vec3 } from '../src/science/types';
import type { VisibilitySummary } from '../src/science/landingTypes';
import { dot, normalize, sub, length, cross } from '../src/science/vectors';
import { TerrainMask } from './lunarTerrain';
import { LUNAR_CYCLE_SECONDS } from './lunarEnvironment';

export const SAMPLE_MS = 30 * 60000;
export type SkySample = { time: number; earth: Vec3; sun: Vec3 };
export type SurfaceTimeline = { time: number; communication: boolean; sunlight: boolean; communicationUnknown: boolean; sunlightUnknown: boolean }[];

export function earthEclipsesSun(origin: Vec3, earth: Vec3, sun: Vec3) {
  const toEarth = sub(earth, origin), toSun = sub(sun, origin);
  const sep = Math.acos(Math.max(-1, Math.min(1, dot(normalize(toEarth), normalize(toSun)))));
  return sep <= Math.asin(6378137 / length(toEarth)) + Math.asin(695700000 / length(toSun));
}

export function surfaceTimeline(mask: TerrainMask, latitude: number, longitude: number, sky: SkySample[]): SurfaceTimeline {
  const origin = mask.surface(latitude, longitude, 2);
  const east = sub(mask.surface(latitude, longitude + 0.01, 2), mask.surface(latitude, longitude - 0.01, 2));
  const north = sub(mask.surface(latitude + 0.01, longitude, 2), mask.surface(latitude - 0.01, longitude, 2));
  const normal = normalize(cross(east, north));
  return sky.map(s => {
    const earth = mask.lineOfSight(origin, s.earth);
    const incidence = dot(normal, normalize(sub(s.sun, origin)));
    const solar = incidence > Math.sin(Math.PI / 180) && !earthEclipsesSun(origin, s.earth, s.sun) ? mask.lineOfSight(origin, s.sun) : 'blocked';
    return { time: s.time, communication: earth === 'clear', sunlight: solar === 'clear', communicationUnknown: earth === 'unknown', sunlightUnknown: solar === 'unknown' };
  });
}

export function summarizeVisibility(timeline: SurfaceTimeline, arrival: number, key: 'communication' | 'sunlight'): VisibilitySummary {
  const end = arrival + LUNAR_CYCLE_SECONDS * 1000;
  if (!timeline.length || arrival < timeline[0].time || end > timeline[timeline.length - 1].time) throw new Error('A complete lunar cycle must be covered; no extrapolation');
  const first = Math.max(0, Math.floor((arrival - timeline[0].time) / SAMPLE_MS));
  let visible = 0, checked = 0, continuous = 0, failed = false;
  for (let i = first; i + 1 < timeline.length && timeline[i].time < end; i++) {
    const duration = Math.max(0, Math.min(end, timeline[i + 1].time) - Math.max(arrival, timeline[i].time));
    const unknownKey=key==='communication'?'communicationUnknown':'sunlightUnknown';
    const good = timeline[i][key] && timeline[i + 1][key] && !timeline[i][unknownKey] && !timeline[i + 1][unknownKey];
    checked += duration;
    if (good) { visible += duration; if (!failed) continuous += duration; } else failed = true;
  }
  return { continuousHours: continuous / 3600000, visiblePercent: 100 * visible / checked, checkedHours: checked / 3600000, fullCycleClear: !failed, uncertaintyMinutes: 30 };
}
