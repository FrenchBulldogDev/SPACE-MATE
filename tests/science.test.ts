import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { LAUNCH_SITES, METERS_PER_SCENE_UNIT, PHYSICS } from '../src/config.ts';
import { frameAt, icrfToScene, distanceDisplayScale } from '../src/scene/referenceFrame.ts';
import { evaluateHermite, hermiteCoefficients, interpolateEphemeris, spherical, validateEphemeris } from '../src/science/ephemeris.ts';
import { findProximityMinima, proximityAt, rootsOnUnitInterval, siteState } from '../src/science/windows.ts';
import { cross, dot, geodeticPosition, length, sub, terrestrialBasis } from '../src/science/vectors.ts';
import type { Ephemeris, StateVector, Vec3 } from '../src/science/types.ts';
import { horizonsParameters, parseVectors } from '../server/horizons.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/horizons-geocentric.json', import.meta.url), 'utf8')) as Ephemeris;
const raw = await readFile(new URL('./fixtures/horizons-vectors.txt', import.meta.url), 'utf8');
const axisState = (angle: number, radius: number, omega: number): StateVector => ({ position: [radius * Math.cos(angle), radius * Math.sin(angle), 0], velocity: [-radius * omega * Math.sin(angle), radius * omega * Math.cos(angle), 0] });
function syntheticEphemeris(): Ephemeris {
  const omegaMoon = 2.6617e-6, omegaEarth = 7.2921e-5;
  const points = Array.from({ length: 8065 }, (_, i) => {
    const t = i * 300, moon = axisState(0.7 + t * omegaMoon, 384400000, omegaMoon);
    return { time: t * 1000, moon, greenwich: axisState(t * omegaEarth, 6378137, omegaEarth), northPole: { position: [0, 0, 6356752.314245] as Vec3, velocity: [0, 0, 0] as Vec3 }, spherical: spherical(moon.position) };
  });
  return { ...fixture, start: 0, stop: 28 * 86400000, points, daily: points.filter((_, i) => i % 288 === 0) };
}
const synthetic = syntheticEphemeris();
const equator = { id: 'test', name: 'test', region: 'test', latitude: 0, longitude: 0 };

test('Horizons query uses the Earth center, geometric ICRF and explicit UTC/km/s', () => {
  const p = horizonsParameters(fixture.start, '301');
  for (const [key, expected] of Object.entries({ CENTER: "'500@399'", COMMAND: "'301'", REF_SYSTEM: "'ICRF'", REF_PLANE: "'FRAME'", VEC_CORR: "'NONE'", TIME_TYPE: "'UT'", OUT_UNITS: "'KM-S'", STEP_SIZE: "'5 m'" })) assert.equal(p.get(key), expected);
  assert.equal(Date.parse(p.get('STOP_TIME')!.replaceAll("'", '').replace(' ', 'T') + 'Z') - fixture.start, 28 * 86400000);
});

test('Actual JPL CSV parses to SI, and malformed units/centers/rows are rejected', () => {
  const parsed = parseVectors(raw, fixture.start, 4);
  assert.deepEqual(parsed, fixture.points.map(p => p.moon));
  assert.throws(() => parseVectors(raw.replace('Earth (399)', 'Earth-Moon Barycenter (3)'), fixture.start, 4));
  assert.throws(() => parseVectors(raw.replace('KM-S', 'AU-D'), fixture.start, 4));
  assert.throws(() => parseVectors(raw, fixture.start + 1000, 4));
  assert.throws(() => parseVectors(raw, fixture.start, 5));
});

test('Spherical coordinates round-trip without mixing RA, geographic longitude or ecliptic latitude', () => {
  for (const p of fixture.points) {
    const s = p.spherical;
    const reconstructed: Vec3 = [s.radiusMeters * Math.cos(s.declinationRadians) * Math.cos(s.rightAscensionRadians), s.radiusMeters * Math.cos(s.declinationRadians) * Math.sin(s.rightAscensionRadians), s.radiusMeters * Math.sin(s.declinationRadians)];
    assert.ok(length(sub(reconstructed, p.moon.position)) < 1e-6);
  }
});

test('Real JPL terrestrial axes form an orthonormal, right-handed basis and recover fixed points', () => {
  for (const p of fixture.points) {
    const b = terrestrialBasis(p.greenwich, p.northPole);
    assert.ok(Math.abs(dot(b.x.position, b.z.position)) < 1e-14);
    assert.ok(length(sub(cross(b.x.position, b.y.position), b.z.position)) < 1e-14);
    assert.ok(Math.abs(length(b.x.position) - 1) < 1e-14);
    const actual = siteState(fixture, p.time, equator);
    assert.ok(length(sub(actual.position, p.greenwich.position)) < 0.001);
    assert.ok(length(sub(actual.velocity, p.greenwich.velocity)) < 1e-6);
  }
});

test('Both render modes share the same astronomical axes, Earth orientation and lunar near side', () => {
  const time = fixture.start + 45000;
  const a = frameAt(fixture, time, 'real'), b = frameAt(fixture, time, 'public');
  assert.ok(a.earth.equals(new Vector3()) && b.earth.equals(new Vector3()));
  assert.ok(b.moon.distanceTo(a.moon.clone().multiplyScalar(distanceDisplayScale('public'))) < 1e-12);
  assert.ok(a.earthOrientation.angleTo(b.earthOrientation) < 1e-7);
  assert.ok(new Vector3(1, 0, 0).applyQuaternion(a.moonOrientation).distanceTo(a.moon.clone().normalize().negate()) < 1e-12);
  const point = interpolateEphemeris(fixture, time);
  const zeroLongitude = new Vector3(1, 0, 0).applyQuaternion(a.earthOrientation);
  assert.ok(zeroLongitude.distanceTo(icrfToScene(terrestrialBasis(point.greenwich, point.northPole).x.position)) < 1e-12);
  const east = new Vector3(0, 0, -1).applyQuaternion(a.earthOrientation);
  assert.ok(east.distanceTo(icrfToScene(terrestrialBasis(point.greenwich, point.northPole).y.position)) < 1e-12);
  assert.ok(Math.abs(a.moon.length() * METERS_PER_SCENE_UNIT - point.spherical.radiusMeters) < 1e-6);
});

test('Hermite interpolation preserves endpoint positions and physical velocities, rejecting extrapolation', () => {
  const a = fixture.points[0], b = fixture.points[1];
  const coefficients = hermiteCoefficients(a.moon, b.moon, 300);
  for (const [u, expected] of [[0, a.moon], [1, b.moon]] as const) {
    const actual = evaluateHermite(coefficients, u, 300);
    assert.ok(length(sub(actual.position, expected.position)) < 1e-6);
    assert.ok(length(sub(actual.velocity, expected.velocity)) < 1e-9);
  }
  assert.throws(() => interpolateEphemeris(fixture, fixture.start - 1), RangeError);
  assert.throws(() => interpolateEphemeris(fixture, fixture.stop + 1), RangeError);
});

test('Polynomial root isolation finds repeated roots and multiple extrema inside one sample interval', () => {
  const multiply = (a: number[], b: number[]) => { const p = Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { p[i + j] += x * y; })); return p; };
  let p = [1];
  for (const root of [0.2, 0.2, 0.5, 0.8, 0.8]) p = multiply(p, [-root, 1]);
  const roots = rootsOnUnitInterval(p);
  assert.equal(roots.length, 3);
  roots.forEach((r, i) => assert.ok(Math.abs(r - [0.2, 0.5, 0.8][i]) < 1e-6));
  const extrema = rootsOnUnitInterval([-0.375, 2.75, -6, 4]);
  assert.equal(extrema.length, 3);
  extrema.forEach((r, i) => assert.ok(Math.abs(r - [0.25, 0.5, 0.75][i]) < 1e-8));
});

test('Continuous rotating-site solution matches analytic conjunctions throughout 28 days', () => {
  const report = findProximityMinima(synthetic, equator);
  const relativeRate = 7.2921e-5 - 2.6617e-6;
  const expected: number[] = [];
  for (let k = 0; ; k++) {
    const t = (0.7 + k * 2 * Math.PI) / relativeRate;
    if (t * 1000 >= synthetic.stop) break;
    expected.push(t * 1000);
  }
  assert.equal(report.minima.length, expected.length);
  report.minima.forEach((m, i) => {
    assert.ok(Math.abs(m.time - expected[i]) < 10, `Minimum ${i} differs by ${m.time - expected[i]} ms`);
    assert.ok(Math.abs(m.rhoMeters - (384400000 - 6378137 - PHYSICS.moonRadiusMeters)) < 0.02);
    assert.ok(Math.abs(m.radialVelocityMetersPerSecond) < 1e-5);
    assert.ok(m.curvatureMetersPerSecondSquared > 0);
    assert.ok(m.aboveHorizon && m.elevationDegrees > 89.999);
    assert.ok(proximityAt(synthetic, m.time - 10000, equator).rhoMeters > m.rhoMeters);
    assert.ok(proximityAt(synthetic, m.time + 10000, equator).rhoMeters > m.rhoMeters);
  });
});

test('Longitude shifts minima, hemisphere changes geometry, and height changes the true surface range', () => {
  const east = { ...equator, longitude: 90 };
  const a = findProximityMinima(synthetic, equator), b = findProximityMinima(synthetic, east);
  assert.ok(Math.abs(a.minima[0].time - b.minima[0].time) > 1e6);
  const elevated = proximityAt(synthetic, a.minima[0].time, { ...equator, heightMeters: 1000 });
  assert.ok(Math.abs(elevated.rhoMeters - a.minima[0].rhoMeters + 1000) < 0.01);
  assert.ok(length(geodeticPosition(90, 0)) < length(geodeticPosition(0, 0)));
  assert.throws(() => geodeticPosition(91, 0));
  assert.throws(() => geodeticPosition(0, 181));
  assert.throws(() => geodeticPosition(0, 0, NaN));
});

test('Incomplete caches, inconsistent spherical points and missing dates cannot enter the calculation', () => {
  validateEphemeris(synthetic);
  assert.throws(() => validateEphemeris(fixture));
  const corrupt = structuredClone(synthetic);
  corrupt.points[1].time += 1;
  assert.throws(() => validateEphemeris(corrupt));
  corrupt.points[1].time -= 1; corrupt.points[1].spherical.radiusMeters += 20;
  assert.throws(() => validateEphemeris(corrupt));
});

test('The launch catalog contains NASA, SpaceX and Russian sites, with no Chinese sites', () => {
  assert.ok(LAUNCH_SITES.some(s => s.name.includes('NASA')));
  assert.ok(LAUNCH_SITES.some(s => s.name.includes('SpaceX')));
  for (const name of ['Baikonur', 'Plesetsk', 'Vostochny']) assert.ok(LAUNCH_SITES.some(s => s.name.includes(name)));
  assert.equal(new Set(LAUNCH_SITES.map(s => s.id)).size, LAUNCH_SITES.length);
  for (const site of LAUNCH_SITES) {
    assert.ok(!/China|Chinese|Wenchang|Jiuquan|Taiyuan|Xichang/i.test(site.name + site.region));
    assert.ok(site.source?.startsWith('https://'));
    assert.doesNotThrow(() => geodeticPosition(site.latitude, site.longitude));
  }
});
