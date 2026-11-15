import type { LandingCandidate, LunarSite } from './landingTypes';

export const landingSiteKey = (site: LunarSite) => `${site.latitude},${site.longitude}`;

// Reports can contain several arrival opportunities at exactly the same
// coordinate. Keep every distinct sampled site, including nearby refinements.
export function landingMarkerCandidates(candidates: LandingCandidate[], day: string, bestEnergy = false) {
  const sites = new Map<string, LandingCandidate>();
  for (const candidate of candidates) {
    if (day && new Date(candidate.arrival).toISOString().slice(0, 10) !== day) continue;
    if (bestEnergy && !candidate.solarEnergy) continue;
    const key = landingSiteKey(candidate.site);
    const previous = sites.get(key);
    if (!previous || bestEnergy && candidate.solarEnergy!.equivalentSunHours > previous.solarEnergy!.equivalentSunHours) sites.set(key, candidate);
  }
  return [...sites.values()];
}
