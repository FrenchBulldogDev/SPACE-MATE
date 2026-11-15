import type { HistoricalFlight } from './flightHistory';
import type { LandingCandidate } from './landingTypes';

export type HistoricalSiteSnapshot = {
  missionId: string; time: number;
  communication: 'clear' | 'blocked' | 'unknown';
  sunlight: 'clear' | 'blocked' | 'unknown';
  earthElevationDegrees: number; sunElevationDegrees: number; earthDistanceKm: number;
  terrainResolutionMeters: number; terrainSource: string;
};

// Only the original touchdown coordinate belongs to a flag. A nearby grid
// refinement is a different location, even when its ID contains the mission.
export function historicalSiteCandidate(mission: HistoricalFlight, candidates: LandingCandidate[], day: string, time: number) {
  return candidates.filter(candidate => Math.abs(candidate.site.latitude - mission.latitude) < 1e-7
    && Math.abs(candidate.site.longitude - mission.longitude) < 1e-7
    && (!day || new Date(candidate.arrival).toISOString().slice(0, 10) === day))
    .sort((a, b) => Math.abs(a.arrival - time) - Math.abs(b.arrival - time))[0] ?? null;
}
