import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalSiteRequest, historicalSiteSnapshot } from '../server/historicalSite';
import { TerrainMask, type TerrainGrid } from '../server/lunarTerrain';
import { FLIGHT_HISTORY } from '../src/science/flightHistory';
import { historicalSiteCandidate } from '../src/science/historicalSites';
import { historicalMessages } from '../src/science/historicalMessages';
import type { LandingCandidate } from '../src/science/landingTypes';

test('Historical site requests require a catalogued mission and an instant inside the current ephemeris', () => {
  const params = (mission = 'Apollo 11', time = '100') => new URLSearchParams({ mission, time });
  assert.equal(historicalSiteRequest(params(), 0, 200).mission.id, 'Apollo 11');
  assert.equal(historicalSiteRequest(params('Luna 9', '200'), 0, 200).time, 200);
  for (const p of [params('unknown'), params('Apollo 11', '-1'), params('Apollo 11', '201'), params('Apollo 11', ''), params('Apollo 11', 'NaN'), params('Apollo 11', 'Infinity'), new URLSearchParams({ mission: 'Apollo 11' })]) {
    assert.throws(() => historicalSiteRequest(p, 0, 200));
  }
});

test('Current site snapshots distinguish blocked, clear and unresolved rays without inventing flight data', () => {
  const grid: TerrainGrid = { width: 65, height: 65, west: -2, east: 2, south: -2, north: 2, heights: Array(65 * 65).fill(0), source: 'synthetic test terrain', fetchedAt: 'test' };
  const mask = new TerrainMask(grid, 0, 0);
  try {
    const good = historicalSiteSnapshot(mask, 'test', 0, 0, { time: 1234, earth: [4e8, 0, 0], sun: [1.5e11, 1.5e11, 0] });
    assert.equal(good.communication, 'clear'); assert.equal(good.sunlight, 'clear');
    assert.ok(Math.abs(good.earthElevationDegrees - 90) < 0.01);
    assert.ok(Math.abs(good.sunElevationDegrees - 45) < 0.01);
    assert.equal(good.time, 1234); assert.equal(good.missionId, 'test');
    assert.ok(Math.abs(good.earthDistanceKm - (4e8 - 1737402) / 1000) < 0.001);
    const blocked = historicalSiteSnapshot(mask, 'test', 0, 0, { time: 1234, earth: [-4e8, 0, 0], sun: [-1.5e11, 0, 0] });
    assert.equal(blocked.communication, 'blocked'); assert.equal(blocked.sunlight, 'blocked');
    const origin = mask.surface(0, 0, 2), angle = Math.PI / 180;
    const uncertain = historicalSiteSnapshot(mask, 'test', 0, 0, { time: 1234, earth: [origin[0] + 4e8 * Math.sin(angle), 4e8 * Math.cos(angle), 0], sun: [-1.5e11, 0, 0] });
    assert.equal(uncertain.communication, 'unknown');
    assert.equal('flightHours' in good, false);
  } finally { mask.dispose(); }
});

test('A flag uses only candidates at the exact touchdown coordinate, respecting the selected UTC day', () => {
  const mission = FLIGHT_HISTORY[0], time = Date.parse('2026-11-15T12:00:00Z');
  const candidate = (latitude: number, arrival: number) => ({ site: { id: mission.id, latitude, longitude: mission.longitude }, arrival }) as LandingCandidate;
  const nearby = candidate(mission.latitude + 0.25, time), exact = candidate(mission.latitude, time + 3600000), otherDay = candidate(mission.latitude, time + 86400000);
  assert.equal(historicalSiteCandidate(mission, [nearby, otherDay, exact], '', time), exact);
  assert.equal(historicalSiteCandidate(mission, [nearby, otherDay, exact], '2026-11-16', time), otherDay);
  assert.equal(historicalSiteCandidate(mission, [nearby], '', time), null);
  assert.equal(historicalSiteCandidate(mission, [exact], '2026-11-17', time), null);
});

test('Historical site controls have complete text in all five interface languages', () => {
  const keys = Object.keys(historicalMessages.en).sort();
  for (const messages of Object.values(historicalMessages)) {
    assert.deepEqual(Object.keys(messages).sort(), keys);
    assert.ok(Object.values(messages).every(value => value.trim().length));
  }
});
