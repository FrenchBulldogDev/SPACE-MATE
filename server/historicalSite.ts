import { FLIGHT_HISTORY } from '../src/science/flightHistory';
import type { HistoricalSiteSnapshot } from '../src/science/historicalSites';
import { cross, dot, length, normalize, sub } from '../src/science/vectors';
import { surfaceTimeline, type SkySample } from './landingSimulation';
import type { TerrainMask } from './lunarTerrain';

export function historicalSiteRequest(params: URLSearchParams, start: number, stop: number) {
  const mission = FLIGHT_HISTORY.find(flight => flight.id === params.get('mission'));
  const time = params.has('time') && params.get('time')?.trim() ? Number(params.get('time')) : NaN;
  if (!mission || !Number.isFinite(time) || time < start || time > stop) throw Error('Invalid historical site or instant');
  return { mission, time };
}

export function historicalSiteSnapshot(mask: TerrainMask, missionId: string, latitude: number, longitude: number, sky: SkySample): HistoricalSiteSnapshot {
  const origin = mask.surface(latitude, longitude, 2);
  const east = sub(mask.surface(latitude, longitude + 0.01, 2), mask.surface(latitude, longitude - 0.01, 2));
  const north = sub(mask.surface(latitude + 0.01, longitude, 2), mask.surface(latitude - 0.01, longitude, 2));
  const normal = normalize(cross(east, north));
  const elevation = (target: SkySample['earth']) => Math.asin(Math.max(-1, Math.min(1, dot(normal, normalize(sub(target, origin)))))) * 180 / Math.PI;
  const sample = surfaceTimeline(mask, latitude, longitude, [sky])[0];
  return {
    missionId, time: sky.time,
    communication: sample.communicationUnknown ? 'unknown' : sample.communication ? 'clear' : 'blocked',
    sunlight: sample.sunlightUnknown ? 'unknown' : sample.sunlight ? 'clear' : 'blocked',
    earthElevationDegrees: elevation(sky.earth), sunElevationDegrees: elevation(sky.sun),
    earthDistanceKm: length(sub(sky.earth, origin)) / 1000,
    terrainResolutionMeters: mask.resolutionMeters, terrainSource: mask.grid.source,
  };
}
