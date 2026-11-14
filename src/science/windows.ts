import { PHYSICS, type LaunchSite } from '../config';
import { evaluateHermite, hermiteCoefficients, interpolateEphemeris, intervalIndex } from './ephemeris';
import type { Ephemeris, ProximityMinimum, ProximityReport, StateVector, Vec3 } from './types';
import { dot, geodeticPosition, inBasis, length, sub, terrestrialBasis } from './vectors';

const polynomialValue = (p: number[], x: number) => p.reduceRight((value, c) => value * x + c, 0);
const derivative = (p: number[]) => p.slice(1).map((c, i) => c * (i + 1));

// Isolate EVERY real root of a polynomial on [0,1]. Critical points recursively
// partition it into monotone intervals, including repeated/tangent roots.
// A sampled sign-change scan alone can miss multiple roots within one interval.
export function rootsOnUnitInterval(coefficients: number[]): number[] {
  const magnitude = Math.max(...coefficients.map(Math.abs));
  if (!magnitude) return [];
  const p = coefficients.map(c => c / magnitude);
  while (p.length > 1 && Math.abs(p[p.length - 1]) < 1e-15) p.pop();
  if (p.length === 1) return [];
  if (p.length === 2) {
    const root = -p[0] / p[1];
    return root >= 0 && root <= 1 ? [root] : [];
  }
  const divisions = [0, ...rootsOnUnitInterval(derivative(p)).filter(r => r > 0 && r < 1), 1];
  const roots: number[] = [];
  for (const point of divisions) if (Math.abs(polynomialValue(p, point)) < 1e-13) roots.push(point);
  for (let i = 0; i + 1 < divisions.length; i++) {
    let left = divisions[i], right = divisions[i + 1];
    let fLeft = polynomialValue(p, left);
    if (fLeft * polynomialValue(p, right) >= 0) continue;
    for (let iteration = 0; iteration < 60 && right - left > 1e-11; iteration++) {
      const mid = (left + right) / 2, fMid = polynomialValue(p, mid);
      if (fMid === 0) { left = right = mid; break; }
      if (fLeft * fMid <= 0) right = mid; else { left = mid; fLeft = fMid; }
    }
    roots.push((left + right) / 2);
  }
  return roots.sort((a, b) => a - b).filter((r, i, all) => i === 0 || r - all[i - 1] > 1e-8);
}

export function siteState(data: Ephemeris, time: number, site: LaunchSite): StateVector {
  const p = interpolateEphemeris(data, time);
  return inBasis(geodeticPosition(site.latitude, site.longitude, site.heightMeters ?? 0), terrestrialBasis(p.greenwich, p.northPole));
}

export function proximityAt(data: Ephemeris, time: number, site: LaunchSite): ProximityMinimum {
  const index = intervalIndex(data, time), a = data.points[index], b = data.points[index + 1];
  const dt = (b.time - a.time) / 1000, u = (time - a.time) / (b.time - a.time);
  const coordinates = geodeticPosition(site.latitude, site.longitude, site.heightMeters ?? 0);
  const aSite = inBasis(coordinates, terrestrialBasis(a.greenwich, a.northPole));
  const bSite = inBasis(coordinates, terrestrialBasis(b.greenwich, b.northPole));
  const relative = (moon: StateVector, surface: StateVector): StateVector => ({ position: sub(moon.position, surface.position), velocity: sub(moon.velocity, surface.velocity) });
  const state = evaluateHermite(hermiteCoefficients(relative(a.moon, aSite), relative(b.moon, bSite), dt), u, dt);
  const distance = length(state.position), radial = dot(state.position, state.velocity) / distance;
  const phi = site.latitude * Math.PI / 180, lambda = site.longitude * Math.PI / 180;
  const normal: Vec3 = [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
  const p = interpolateEphemeris(data, time);
  const zenith = inBasis(normal, terrestrialBasis(p.greenwich, p.northPole)).position;
  const elevationDegrees = Math.asin(Math.max(-1, Math.min(1, dot(state.position, zenith) / distance))) * 180 / Math.PI;
  return {
    time, rhoMeters: distance - PHYSICS.moonRadiusMeters, centerDistanceMeters: distance,
    radialVelocityMetersPerSecond: radial,
    curvatureMetersPerSecondSquared: (dot(state.velocity, state.velocity) + dot(state.position, state.acceleration) - radial ** 2) / distance,
    elevationDegrees, aboveHorizon: elevationDegrees > 0,
  };
}

export function findProximityMinima(data: Ephemeris, site: LaunchSite): ProximityReport {
  const coordinates = geodeticPosition(site.latitude, site.longitude, site.heightMeters ?? 0);
  const relative = data.points.map(p => {
    const surface = inBasis(coordinates, terrestrialBasis(p.greenwich, p.northPole));
    return { position: sub(p.moon.position, surface.position), velocity: sub(p.moon.velocity, surface.velocity) };
  });
  const times: number[] = [];
  for (let i = 0; i + 1 < relative.length; i++) {
    const dt = (data.points[i + 1].time - data.points[i].time) / 1000;
    const c = hermiteCoefficients(relative[i], relative[i + 1], dt);
    // d(|r|²)/du = 2 r·r', a quintic: no projection or frozen-Earth shortcut.
    const polynomial = Array<number>(6).fill(0);
    for (let j = 0; j <= 3; j++) for (let k = 1; k <= 3; k++) polynomial[j + k - 1] += 2 * k * dot(c[j], c[k]);
    for (const u of rootsOnUnitInterval(polynomial)) {
      const time = data.points[i].time + u * dt * 1000;
      if (time <= data.start || time >= data.stop) continue;
      const second = polynomialValue(derivative(polynomial), u);
      // A simple minimum has positive second derivative. Higher-order flat
      // minima are classified by the derivative on both sides of the root.
      const isMinimum = second > 1e-8 || (Math.abs(second) <= 1e-8 && polynomialValue(polynomial, Math.max(0, u - 1e-4)) < 0 && polynomialValue(polynomial, Math.min(1, u + 1e-4)) > 0);
      if (isMinimum && !times.some(t => Math.abs(t - time) < 0.01)) times.push(time);
    }
  }
  const minima = times.sort((a, b) => a - b).map(time => proximityAt(data, time, site));
  const start = proximityAt(data, data.start, site), stop = proximityAt(data, data.stop, site);
  const global = [start, ...minima, stop].reduce((best, point) => point.rhoMeters < best.rhoMeters ? point : best);
  return {
    ephemerisId: data.id, minima, global, globalIsBoundary: global.time === data.start || global.time === data.stop,
    start, stop, rootToleranceSeconds: 0.01, interpolation: 'cubic Hermite, position and velocity',
  };
}
