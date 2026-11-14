import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { LAUNCH_SITES, PHYSICS } from '../src/config';
import { validateEphemeris } from '../src/science/ephemeris';
import { findProximityMinima, proximityAt } from '../src/science/windows';
import type { Ephemeris } from '../src/science/types';
import { length } from '../src/science/vectors';

const id = process.argv.find(arg => /^[a-f0-9]{24}$/.test(arg)) || 'ea770d664ee922b8485d91d8';
const data: Ephemeris = JSON.parse(await readFile(`data/horizons/${id}.json`, 'utf8'));
validateEphemeris(data);
const reports = LAUNCH_SITES.map(site => {
  const report = findProximityMinima(data, site);
  for (const p of report.minima) {
    assert.ok(p.curvatureMetersPerSecondSquared > 0);
    assert.ok(Math.abs(p.radialVelocityMetersPerSecond) < 1e-4);
    assert.ok(proximityAt(data, p.time - 1000, site).rhoMeters >= p.rhoMeters - 1e-5);
    assert.ok(proximityAt(data, p.time + 1000, site).rhoMeters >= p.rhoMeters - 1e-5);
  }
  // Convergence under doubling the interpolation step; this independently
  // changes the fitted curve, rather than repeating the same root calculation.
  const coarser = { ...data, stepSeconds: 600, points: data.points.filter((_, i) => i % 2 === 0) };
  const comparison = findProximityMinima(coarser, site);
  assert.equal(report.minima.length, comparison.minima.length);
  const convergence = {
    maxTimeChangeSeconds: Math.max(...report.minima.map((p, i) => Math.abs(p.time - comparison.minima[i].time) / 1000)),
    maxRangeChangeMeters: Math.max(...report.minima.map((p, i) => Math.abs(p.rhoMeters - comparison.minima[i].rhoMeters))),
  };
  return { site, report, convergence };
});

const verification: Record<string, unknown> = { verifiedAt: new Date().toISOString(), ephemerisId: data.id, reports };
if (process.argv.includes('--online')) {
  const site = LAUNCH_SITES[0], report = reports[0].report;
  const instants = [report.minima[0], report.global, report.minima[report.minima.length - 1]];
  const tlist = instants.map(p => (p.time / 86400000 + 2440587.5).toFixed(12)).join(',');
  const parameters = new URLSearchParams({ format: 'json' });
  const options = {
    COMMAND: '301', CENTER: 'coord@399', COORD_TYPE: 'GEODETIC', SITE_COORD: `${site.longitude},${site.latitude},0`,
    EPHEM_TYPE: 'VECTORS', OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', REF_SYSTEM: 'ICRF', REF_PLANE: 'FRAME',
    VEC_CORR: 'NONE', OUT_UNITS: 'KM-S', VEC_TABLE: '2', CSV_FORMAT: 'YES', TIME_TYPE: 'UT', TLIST_TYPE: 'JD', TLIST: tlist,
  };
  for (const [key, value] of Object.entries(options)) parameters.set(key, `'${value}'`);
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${parameters}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  const payload = await response.json() as { result?: string; error?: string };
  if (!response.ok || payload.error || !payload.result?.includes('$$SOE')) throw new Error(payload.error || payload.result || `Horizons HTTP ${response.status}`);
  const rows = payload.result.split('$$SOE')[1].split('$$EOE')[0].trim().split(/\r?\n/);
  assert.equal(rows.length, instants.length);
  const directComparison = rows.map((row, i) => {
    const fields = row.split(',').map(v => v.trim());
    const position = fields.slice(2, 5).map(Number) as [number, number, number];
    const velocity = fields.slice(5, 8).map(Number);
    const range = length(position) * 1000;
    const radial = position.reduce((sum, v, k) => sum + v * velocity[k], 0) / length(position) * 1000;
    return { time: new Date(instants[i].time).toISOString(), directRhoMeters: range - PHYSICS.moonRadiusMeters, rangeDifferenceMeters: range - instants[i].centerDistanceMeters, directRadialVelocityMetersPerSecond: radial };
  });
  for (const p of directComparison) {
    assert.ok(Math.abs(p.rangeDifferenceMeters) < 1, `Topocentric disagreement: ${p.rangeDifferenceMeters} m`);
    assert.ok(Math.abs(p.directRadialVelocityMetersPerSecond) < 0.001);
  }
  await writeFile(`data/horizons/${id}-topocentric-verification.txt`, payload.result);
  verification.topocentric = { url, directComparison };
}
await writeFile(`data/horizons/${id}-verification.json`, JSON.stringify(verification, null, 2));
console.log(JSON.stringify({ ephemerisId: id, sites: reports.map(r => ({ id: r.site.id, minima: r.report.minima.length, globalUTC: new Date(r.report.global.time).toISOString(), rhoKm: r.report.global.rhoMeters / 1000, ...r.convergence })), topocentric: verification.topocentric }, null, 2));
