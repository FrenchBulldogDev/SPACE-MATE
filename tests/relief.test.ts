import test from 'node:test';
import assert from 'node:assert/strict';
import { TerrainMask, lunarPoint, terrainExtent, type FarField, type TerrainGrid } from '../server/lunarTerrain';
import { poolSamples, reliefEnvelope, type ReliefGrid } from '../server/lunarRelief';
import { LUNAR_CYCLE_SECONDS } from '../server/lunarEnvironment';
import type { Vec3 } from '../src/science/types';

test('The evaluated lunar cycle is one synodic month, a full day and night at a site', () => {
  assert.ok(Math.abs(LUNAR_CYCLE_SECONDS / 86400 - 29.530589) < 1e-9);
});

test('Local DEM patches keep a roughly fixed ground size instead of shrinking toward the poles', () => {
  const kmPerDegree = Math.PI / 180 * 1737.4;
  // Low latitudes keep the original request exactly, so cached downloads are reused.
  assert.deepEqual(terrainExtent(0, 10), [8, -2, 12, 2]);
  assert.deepEqual(terrainExtent(25.25, -40), [-42, 23.25, -38, 27.25]);
  for (const latitude of [35, -55, 75, 85.25, -88]) {
    const [west, south, east, north] = terrainExtent(latitude, 20);
    assert.deepEqual([south, north], [latitude - 2, latitude + 2]);
    const halfWidthKm = (east - west) / 2 * Math.cos(latitude * Math.PI / 180) * kmPerDegree;
    assert.ok(Math.abs(halfWidthKm - 2 * kmPerDegree) < 1e-6, `east-west half width at ${latitude}: ${halfWidthKm} km`);
  }
  // Never wrap across the antimeridian; the far field takes over sooner there.
  const [west, , east] = terrainExtent(85, 175);
  assert.deepEqual([west, east], [170, 180]);
});

const flat: TerrainGrid = { width: 65, height: 65, west: -2, east: 2, south: -2, north: 2, source: 'synthetic test terrain', fetchedAt: 'test', heights: new Array(65 * 65).fill(0) };
test('A ray leaving the local patch is handed to the far field from the patch boundary onward', () => {
  const calls: { near: number; far: number }[] = [];
  let answer: 'clear' | 'blocked' | 'unknown' = 'clear';
  const far: FarField = { shellMeters: 11000, lineOfSight: (_origin, _direction, near, limit) => { calls.push({ near, far: limit }); return answer; } };
  const alone = new TerrainMask(flat, 0, 0), mask = new TerrainMask(flat, 0, 0, far);
  try {
    const origin = mask.surface(0, 0, 2);
    const target = (degrees: number): Vec3 => { const a = degrees * Math.PI / 180; return [origin[0] + 4e8 * Math.sin(a), origin[1] + 4e8 * Math.cos(a), origin[2]]; };
    // Steep rays clear all possible relief inside the patch: no far-field test.
    assert.equal(mask.lineOfSight(origin, target(70)), 'clear');
    assert.equal(calls.length, 0);
    // A 1° ray leaves the patch low. Alone that is unknown; with a far field
    // its verdict is used, starting about where the patch interior ends.
    assert.equal(alone.lineOfSight(origin, target(1)), 'unknown');
    for (const verdict of ['clear', 'blocked', 'unknown'] as const) { answer = verdict; assert.equal(mask.lineOfSight(origin, target(1)), verdict); }
    assert.equal(calls.length, 3);
    const edge = (2 - 4 / 65) * Math.PI / 180 * 1737400;
    for (const call of calls) {
      assert.ok(Math.abs(call.near - edge) < 600, `handover at ${call.near} m, patch interior ends near ${edge} m`);
      assert.ok(call.far > call.near && call.far < 300000);
    }
    // Rays into the ground never reach the far field.
    assert.equal(mask.lineOfSight(origin, [-4e8, 0, 0]), 'blocked');
    assert.equal(calls.length, 3);
  } finally { alone.dispose(); mask.dispose(); }
});

test('A site on twisted terrain starts above the ray mesh, not underneath it', () => {
  // Checkerboard of 0 m and 20 m: at the centre of a quad whose top-left
  // corner is low, bilinear interpolation gives 10 m while the mesh diagonal
  // joins the two 20-m corners. A start point at 10 m + 2 m would be buried.
  const twisted: TerrainGrid = { ...flat, heights: Array.from({ length: 65 * 65 }, (_, i) => ((i % 65) + Math.floor(i / 65)) % 2 ? 20 : 0) };
  const mask = new TerrainMask(twisted, 0, 0);
  try {
    const longitude = 33 / 65 * 4 - 2, latitude = 2 - 33 / 65 * 4; // centre of the quad at pixel (32, 32)
    const ground = mask.surface(latitude, longitude, 0);
    assert.ok(Math.abs(Math.hypot(...ground) - 1737420) < 1e-6);
    // Away from the diagonal the height follows each flat triangle.
    assert.ok(Math.abs(Math.hypot(...mask.surface(latitude + 0.25 * 4 / 65, longitude - 0.25 * 4 / 65, 0)) - 1737410) < 1e-6);
    assert.ok(Math.abs(Math.hypot(...mask.surface(latitude - 0.25 * 4 / 65, longitude + 0.25 * 4 / 65, 0)) - 1737410) < 1e-6);
    const origin = mask.surface(latitude, longitude, 2), p = latitude * Math.PI / 180, l = longitude * Math.PI / 180;
    const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)], east = [-Math.sin(l), Math.cos(l), 0], north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
    for (let azimuth = 0; azimuth < 360; azimuth += 30) {
      const a = azimuth * Math.PI / 180, e = 70 * Math.PI / 180;
      const target = origin.map((value, k) => value + 4e8 * (Math.sin(e) * up[k] + Math.cos(e) * (Math.cos(a) * north[k] + Math.sin(a) * east[k]))) as Vec3;
      assert.equal(mask.lineOfSight(origin, target), 'clear', `azimuth ${azimuth}°`);
    }
  } finally { mask.dispose(); }
});

test('Pooling keeps the highest and lowest sample of every cell and rejects missing data', () => {
  const grid: ReliefGrid = { version: 1, width: 4, height: 2, maximum: new Array(8).fill(-Infinity), minimum: new Array(8).fill(Infinity), cellsPerDegree: 4, samplesPerDegree: 16, sources: [], fetchedAt: 'test' };
  // A 4 x 4 sample tile pooled 2 x 2 into the cells at columns 2-3, rows 0-1.
  poolSamples([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 4, 4, 2, 2, 0, grid);
  assert.deepEqual(grid.maximum.slice(2, 4), [6, 8]); assert.deepEqual(grid.minimum.slice(2, 4), [1, 3]);
  assert.deepEqual(grid.maximum.slice(6, 8), [14, 16]); assert.deepEqual(grid.minimum.slice(6, 8), [9, 11]);
  assert.equal(grid.maximum[0], -Infinity);
  assert.throws(() => poolSamples([1, 2, 3, NaN], 2, 2, 2, 0, 0, grid));
  assert.throws(() => poolSamples([1, 2, 3], 2, 2, 2, 0, 0, grid));
});

test('Far-field envelopes separate clear, blocked and unresolved rays, including across ±180°', () => {
  // Half-degree cells (15 km). Two 6000-m plateaus on the equator, 3° of
  // longitude wide and 3° of latitude tall: one at 3°-5° E, one starting at 180°.
  const width = 720, height = 360, maximum = new Array(width * height).fill(0);
  for (let j = 177; j <= 182; j++) for (let k = 0; k < 4; k++) { maximum[j * width + 366 + k] = 6000; maximum[j * width + k] = 6000; }
  const relief = reliefEnvelope({ version: 1, width, height, maximum, minimum: [...maximum], cellsPerDegree: 2, samplesPerDegree: 2, sources: [], fetchedAt: 'test' }, 500);
  try {
    assert.equal(relief.shellMeters, 6550);
    for (const longitude of [0, 177]) {
      const l = longitude * Math.PI / 180, origin = lunarPoint(0, longitude, 2);
      // Eastward along the equator at a given elevation above the local horizon.
      const sight = (elevation: number, near: number) => {
        const e = elevation * Math.PI / 180;
        return relief.lineOfSight(origin, [Math.sin(e) * Math.cos(l) - Math.cos(e) * Math.sin(l), Math.sin(e) * Math.sin(l) + Math.cos(e) * Math.cos(l), 0], near, 400000);
      };
      // The plateau edge is ~91 km away. A 0.5° ray is still ~3 km high there:
      // below the lower envelope. A 5° ray passes 4 km above the upper one.
      assert.equal(sight(0.5, 60000), 'blocked', `low ray from ${longitude}°`);
      assert.equal(sight(5, 30000), 'clear', `high ray from ${longitude}°`);
      // In between, the ray is under the raised upper surface but over the
      // dropped lower one: the coarse relief cannot decide it.
      assert.equal(sight(1.64, 60000), 'unknown', `grazing ray from ${longitude}°`);
      // Westward there is only flat ground below the ray.
      const w = -5 * Math.PI / 180;
      assert.equal(relief.lineOfSight(origin, [Math.sin(-w) * Math.cos(l) + Math.cos(w) * Math.sin(l), Math.sin(-w) * Math.sin(l) - Math.cos(w) * Math.cos(l), 0], 30000, 400000), 'clear');
    }
    // Over the pole: flat ground stays clear and never touches a seam artefact.
    const polar = lunarPoint(89, 0, 2), p = 89 * Math.PI / 180, e = 5 * Math.PI / 180;
    // Northward at 5° elevation: sin(e)·up + cos(e)·north.
    assert.equal(relief.lineOfSight(polar, [Math.sin(e) * Math.cos(p) - Math.cos(e) * Math.sin(p), 0, Math.sin(e) * Math.sin(p) + Math.cos(e) * Math.cos(p)], 30000, 400000), 'clear');
  } finally { relief.dispose(); }
});
