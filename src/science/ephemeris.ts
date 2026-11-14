import type { Ephemeris, EphemerisPoint, StateVector, Vec3 } from './types';
import { dot, length } from './vectors';
import { monthBounds } from './calendar';

export function spherical(position: Vec3) {
  const radiusMeters = length(position);
  return {
    radiusMeters,
    rightAscensionRadians: (Math.atan2(position[1], position[0]) + 2 * Math.PI) % (2 * Math.PI),
    declinationRadians: Math.atan2(position[2], Math.hypot(position[0], position[1])),
  };
}

// Cubic coefficients in u=(t-t0)/(t1-t0), not absolute Unix time.
export function hermiteCoefficients(a: StateVector, b: StateVector, durationSeconds: number): Vec3[] {
  return [a.position, a.velocity.map(v => v * durationSeconds) as Vec3,
    a.position.map((v, k) => -3 * v + 3 * b.position[k] - durationSeconds * (2 * a.velocity[k] + b.velocity[k])) as Vec3,
    a.position.map((v, k) => 2 * v - 2 * b.position[k] + durationSeconds * (a.velocity[k] + b.velocity[k])) as Vec3];
}

export function evaluateHermite(coefficients: Vec3[], u: number, durationSeconds: number): StateVector & { acceleration: Vec3 } {
  return {
    position: [0, 1, 2].map(k => ((coefficients[3][k] * u + coefficients[2][k]) * u + coefficients[1][k]) * u + coefficients[0][k]) as Vec3,
    velocity: [0, 1, 2].map(k => ((3 * coefficients[3][k] * u + 2 * coefficients[2][k]) * u + coefficients[1][k]) / durationSeconds) as Vec3,
    acceleration: [0, 1, 2].map(k => (6 * coefficients[3][k] * u + 2 * coefficients[2][k]) / durationSeconds ** 2) as Vec3,
  };
}

export function intervalIndex(data: Ephemeris, time: number): number {
  if (!Number.isFinite(time) || data.points.length < 2 || time < data.start || time > data.stop || time < data.points[0].time || time > data.points[data.points.length - 1].time) throw new RangeError('Outside the saved ephemeris; extrapolation is disabled');
  let low = 0, high = data.points.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (data.points[mid].time <= time) low = mid; else high = mid;
  }
  return low;
}

export function interpolateEphemeris(data: Ephemeris, time: number): EphemerisPoint {
  const index = intervalIndex(data, time), a = data.points[index], b = data.points[index + 1];
  const dt = (b.time - a.time) / 1000, u = (time - a.time) / (b.time - a.time);
  const interpolate = (key: 'moon' | 'greenwich' | 'northPole') => evaluateHermite(hermiteCoefficients(a[key], b[key], dt), u, dt);
  const moon = interpolate('moon');
  return { time, moon, greenwich: interpolate('greenwich'), northPole: interpolate('northPole'), spherical: spherical(moon.position) };
}

export function validateEphemeris(value: unknown): asserts value is Ephemeris {
  const data = value as Ephemeris;
  const bounds = data?.arrivalMonth ? monthBounds(data.arrivalMonth) : null;
  const duration = bounds ? bounds.stop - bounds.departureStart : 28 * 86400000;
  if (!data || data.version !== 1 || data.source !== 'NASA/JPL Horizons' || data.frame !== 'ICRF' || data.center !== '500@399' || data.corrections !== 'NONE' || data.timeScale !== 'UTC' || typeof data.id !== 'string' || !Number.isFinite(data.start) || !Number.isFinite(data.stop) || data.stop - data.start !== duration || (bounds && (data.start !== bounds.departureStart || data.stop !== bounds.stop)) || data.stepSeconds !== 300 || !Array.isArray(data.points) || data.points.length !== duration / 300000 + 1 || !Array.isArray(data.daily) || data.daily.length !== duration / 86400000 + 1) throw new Error('Invalid Horizons dataset metadata');
  for (let i = 0; i < data.points.length; i++) {
    const p = data.points[i];
    if (p.time !== data.start + i * 300000) throw new Error('Missing, unordered or mismatched UTC samples');
    for (const key of ['moon', 'greenwich', 'northPole'] as const) {
      if (!p[key] || p[key].position.length !== 3 || p[key].velocity.length !== 3 || ![...p[key].position, ...p[key].velocity].every(Number.isFinite)) throw new Error('Invalid state vector');
    }
    const r = length(p.moon.position);
    if (r < 3e8 || r > 5e8 || Math.abs(length(p.greenwich.position) - 6378137) > 10 || Math.abs(length(p.northPole.position) - 6356752.314245) > 10) throw new Error('Unexpected Horizons units or coordinate center');
    if (Math.abs(dot(p.greenwich.position, p.northPole.position) / (length(p.greenwich.position) * length(p.northPole.position))) > 1e-7) throw new Error('Inconsistent terrestrial reference axes');
    const s = spherical(p.moon.position);
    if (!p.spherical || Math.abs(p.spherical.radiusMeters - s.radiusMeters) > 1e-5 || Math.abs(p.spherical.rightAscensionRadians - s.rightAscensionRadians) > 1e-12 || Math.abs(p.spherical.declinationRadians - s.declinationRadians) > 1e-12) throw new Error('Spherical and Cartesian coordinates disagree');
  }
  for (let i = 0; i < data.daily.length; i++) if (JSON.stringify(data.daily[i]) !== JSON.stringify(data.points[i * 288])) throw new Error('Invalid daily sample');
}
