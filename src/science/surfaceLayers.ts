import type { LandingCandidate } from './landingTypes';
import type { DisplayMode } from './types';

export type SurfaceLayer = 'none' | 'energy' | 'weathering' | 'thermal' | 'dust';
export const availableLayers = (mode: DisplayMode): SurfaceLayer[] => mode === 'real'
  ? ['none', 'energy', 'weathering', 'thermal', 'dust'] : ['none', 'energy', 'weathering'];
export type RasterLayer = {
  version: 1; width: number; height: number;
  west: number; east: number; south: number; north: number;
  values: (number | null)[]; units: string; source: string; citation: string;
  fetchedAt: string; sha256: string; resolutionDegrees: number;
  region?: 'equatorial' | 'north' | 'south';
  archiveSha256?: string; archiveMd5?: string;
};
export type RasterScale = { raster: RasterLayer; minimum: number; maximum: number };
export function rasterScale(raster: RasterLayer): RasterScale {
  const values = raster.values.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  return { raster, minimum: values.length ? values[Math.floor((values.length - 1) * 0.02)] : 0,
    maximum: values.length ? values[Math.floor((values.length - 1) * 0.98)] : 1 };
}
export function weatheringScales(rasters: RasterLayer[]): RasterScale[] {
  const polarValues = rasters.filter(r => r.region === 'north' || r.region === 'south').flatMap(r => r.values).filter((v): v is number => v !== null).sort((a, b) => a - b);
  return rasters.map(raster => raster.region && raster.region !== 'equatorial' && polarValues.length
    ? { raster, minimum: polarValues[Math.floor((polarValues.length - 1) * 0.02)], maximum: polarValues[Math.floor((polarValues.length - 1) * 0.98)] }
    : rasterScale(raster));
}
export type SurfacePoint = { latitude: number; longitude: number; value: number; source: string };
export type SurfaceOverlay = {
  layer: SurfaceLayer; points: SurfacePoint[]; raster?: RasterLayer;
  minimum: number; maximum: number; highIsGood: boolean; opacity: number;
  rasters?: RasterScale[];
};

// Read only the containing source pixel: never extrapolate through NoData or
// outside the published latitude range. Longitudes use east-positive degrees.
export function rasterValue(grid: RasterLayer, latitude: number, longitude: number): number | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < grid.south || latitude > grid.north) return null;
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  if (lon < grid.west || lon >= grid.east) return null;
  const x = Math.floor((lon - grid.west) / (grid.east - grid.west) * grid.width);
  const y = Math.min(grid.height - 1, Math.floor((grid.north - latitude) / (grid.north - grid.south) * grid.height));
  return grid.values[y * grid.width + x] ?? null;
}

export function layerColor(value: number, minimum: number, maximum: number, highIsGood: boolean): [number, number, number] {
  const fraction = maximum > minimum ? Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))) : 0.5;
  const good = highIsGood ? fraction : 1 - fraction;
  // Red → amber → green. Endpoints have the same meaning in every layer.
  return good <= 0.5 ? [224, Math.round(70 + 240 * good), 48]
    : [Math.round(224 - 332 * (good - 0.5)), Math.round(190 - 8 * (good - 0.5)), 48];
}

export function energyPoints(candidates: LandingCandidate[], day: string): SurfacePoint[] {
  const best = new Map<string, LandingCandidate>();
  for (const candidate of candidates) {
    if (day && new Date(candidate.arrival).toISOString().slice(0, 10) !== day) continue;
    // Comparisons must use one full cycle for every candidate. If more than
    // one arrival visits the same coordinate, show its best lower-bound yield.
    if (!candidate.solarEnergy) continue;
    const key = `${candidate.site.latitude}:${candidate.site.longitude}`;
    const previous = best.get(key);
    if (!previous || candidate.solarEnergy.equivalentSunHours > previous.solarEnergy!.equivalentSunHours) best.set(key, candidate);
  }
  return [...best.values()].map(c => ({ latitude: c.site.latitude, longitude: c.site.longitude,
    value: c.solarEnergy!.equivalentSunHours, source: c.terrainSource }));
}
