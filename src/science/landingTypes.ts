export type LunarSite = { id: string; latitude: number; longitude: number; name?: string };
export type VisibilitySummary = {
  continuousHours: number; visiblePercent: number; checkedHours: number;
  fullCycleClear: boolean; uncertaintyMinutes: number;
};
export type LandingCandidate = {
  site: LunarSite; arrival: number; launch: number; flightHours: number; flightMarginHours: number;
  communication: VisibilitySummary; sunlight: VisibilitySummary; jointHours: number;
  terrainResolutionMeters: number; terrainSource: string;
};
export type LandingReport = {
  version: 1; id: string; status: 'estimated'; start: number; stop: number;
  candidates: LandingCandidate[]; coarseSpacingDegrees: number; temporalStepMinutes: number;
  processed: number; excluded: number; unverified: number; searched: number;
  historyIds: string[]; createdAt: string;
  limitations: string[];
};
export type LandingJob = { id: string; status: 'running' | 'complete' | 'error'; completed: number; total: number; stage: string; error?: string; report?: LandingReport };
