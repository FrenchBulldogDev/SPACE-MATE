import test from 'node:test';
import assert from 'node:assert/strict';
import { EarthCoordinates, MoonCoordinates, parseCoordinate, drawCoordinates } from '../Scripts/coordinates.ts';
import { surfaceDirection, lunarPosition, daysFromDate } from '../src/scene/math.ts';
import { SCENE_CONFIG } from '../src/config.ts';

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

test('Illustrative orbit closes and has the configured eccentricity and inclination', () => {
  const peri = lunarPosition(0), apo = lunarPosition(Math.PI);
  assert.ok(Math.abs(peri.length() - SCENE_CONFIG.orbitSemiMajorAxis * (1 - SCENE_CONFIG.orbitEccentricity)) < 1e-10);
  assert.ok(Math.abs(apo.length() - SCENE_CONFIG.orbitSemiMajorAxis * (1 + SCENE_CONFIG.orbitEccentricity)) < 1e-10);
  assert.ok(lunarPosition(0).distanceTo(lunarPosition(2 * Math.PI)) < 1e-10);
  assert.ok(Math.abs(Math.atan2(lunarPosition(Math.PI / 2).y, lunarPosition(Math.PI / 2).z) * 180 / Math.PI - SCENE_CONFIG.orbitInclinationDegrees) < 1e-10);
  assert.equal(daysFromDate('2026-10-06') !== null, true);
  assert.equal(daysFromDate('2026-02-31'), null);
  assert.equal(daysFromDate(''), null);
});
