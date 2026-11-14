import test from 'node:test';
import assert from 'node:assert/strict';
import { EarthCoordinates, MoonCoordinates, parseCoordinate, drawCoordinates } from '../Scripts/coordinates.ts';
import { Vector3 } from 'three';
import { bodyState, earthPosition, lunarOrientation, surfaceDirection, lunarPosition, daysFromDate } from '../src/scene/math.ts';
import { METERS_PER_SCENE_UNIT, PHYSICS, SAMPLE_MOON_DISTANCE_METERS, SCENE_CONFIG } from '../src/config.ts';

test('Coordinates match the spherical UV frame at Greenwich, east/west and poles', () => {
  for (const lat of [-90, -45, 0, 28.6084, 90]) for (const lon of [-180, -80.6043, 0, 90, 180]) {
    const direction = surfaceDirection(lat, lon);
    const pixel = EarthCoordinates(lat, lon);
    assert.ok(Math.abs(direction.length() - 1) < 1e-12);
    assert.ok(Math.abs(pixel.y - (90 - lat) / 180) < 1e-12);
    assert.deepEqual(pixel, MoonCoordinates(lat, lon));
    if (Math.abs(lat) < 90) {
      const reconstructedLon = Math.atan2(-direction.z, direction.x) * 180 / Math.PI;
      assert.ok(Math.abs(reconstructedLon - lon) < 1e-10);
    }
  }
  assert.equal(parseCoordinate('-80.6043', 'longitude'), -80.6043);
  assert.equal(parseCoordinate('28° 36\' 30" N', 'latitude'), 28 + 36 / 60 + 30 / 3600);
  assert.equal(parseCoordinate('', 'latitude'), null);
  assert.equal(parseCoordinate(91, 'latitude'), null);
  assert.equal(parseCoordinate('45 E', 'latitude'), null);
});

test('Supplied drawing function marks the expected map pixel', () => {
  let point: number[] = [];
  const ctx = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc(...values: number[]) { point = values; } } as unknown as CanvasRenderingContext2D;
  drawCoordinates(ctx, 1200, 600, 28.6084, -80.6043, 'earth');
  const uv = EarthCoordinates(28.6084, -80.6043);
  assert.ok(Math.abs(point[0] - uv.x * 1200) < 1e-10);
  assert.ok(Math.abs(point[1] - uv.y * 600) < 1e-10);
});

test('Sample orbit closes at physical scale with the configured inclination', () => {
  assert.equal(SCENE_CONFIG.earthRadius * METERS_PER_SCENE_UNIT, 6_371_000);
  assert.equal(SCENE_CONFIG.moonRadius * METERS_PER_SCENE_UNIT, 1_737_400);
  assert.ok(Math.abs(SAMPLE_MOON_DISTANCE_METERS - 384_400_000) / 384_400_000 < 0.002);
  for (const phase of [0, 0.78, Math.PI / 2, Math.PI, 5]) {
    assert.ok(Math.abs(lunarPosition(phase).length() * METERS_PER_SCENE_UNIT - SAMPLE_MOON_DISTANCE_METERS) < 1e-6);
  }
  assert.ok(lunarPosition(0).distanceTo(lunarPosition(2 * Math.PI)) < 1e-10);
  const quarter = lunarPosition(Math.PI / 2);
  assert.ok(Math.abs(Math.atan(quarter.y / quarter.z) * 180 / Math.PI - SCENE_CONFIG.orbitInclinationDegrees) < 1e-10);
});

test('Same lunar longitude and latitude face Earth throughout the inclined sample orbit', () => {
  for (let i = -32; i <= 32; i++) {
    const phase = i * Math.PI / 16;
    const nearSide = surfaceDirection(0, 0).applyQuaternion(lunarOrientation(phase));
    const toEarth = lunarPosition(phase).normalize().negate();
    assert.ok(nearSide.distanceTo(toEarth) < 1e-12);
    const north = new Vector3(0, 1, 0).applyQuaternion(lunarOrientation(phase));
    assert.ok(Math.abs(north.dot(toEarth)) < 1e-12);
  }
});

test('One simulated second preserves the requested spin and translation rates', () => {
  const start = bodyState(0), end = bodyState(1);
  assert.ok(Math.abs(end.earthRotation - start.earthRotation - 7.2921e-5) < 1e-14);
  // A longer angular interval avoids acos precision loss for tiny rotations.
  const later = bodyState(600);
  assert.ok(Math.abs(start.moonOrientation.angleTo(later.moonOrientation) / 600 - 2.6617e-6) < 1e-12);
  const relativeMoonStart = start.moon.clone().sub(start.earth);
  const relativeMoonEnd = end.moon.clone().sub(end.earth);
  assert.ok(Math.abs(relativeMoonEnd.distanceTo(relativeMoonStart) * METERS_PER_SCENE_UNIT - 1022) < 1e-5);
  assert.ok(Math.abs(end.earth.distanceTo(start.earth) * METERS_PER_SCENE_UNIT - 29_784.8) < 1e-5);
  const period = 2 * Math.PI / PHYSICS.moonRotationRadiansPerSecond;
  const cycle = bodyState(period);
  assert.ok(cycle.moon.clone().sub(cycle.earth).distanceTo(relativeMoonStart) < 1e-10);
  assert.ok(cycle.moonOrientation.angleTo(start.moonOrientation) < 1e-7);
});

test('Earth translates around a one-AU solar reference and carries the lunar system', () => {
  const radius = PHYSICS.earthSunDistanceMeters / METERS_PER_SCENE_UNIT;
  const sun = new Vector3(-radius, 0, 0);
  for (const seconds of [-3_155_760_000, -86400, 0, 86400, 3_155_760_000]) {
    const state = bodyState(seconds);
    assert.ok(Math.abs(earthPosition(seconds).distanceTo(sun) - radius) < 1e-9);
    assert.ok(Math.abs(state.moon.distanceTo(state.earth) - SCENE_CONFIG.orbitSemiMajorAxis) < 1e-9);
    assert.ok(surfaceDirection(0, 0).applyQuaternion(state.moonOrientation).distanceTo(state.earth.clone().sub(state.moon).normalize()) < 1e-12);
  }
});

test('Dates select a reproducible UTC phase and reject invalid calendar dates', () => {
  assert.equal(daysFromDate('2026-10-06') !== null, true);
  assert.equal(daysFromDate('2026-02-31'), null);
  assert.equal(daysFromDate(''), null);
});
