import test from 'node:test';
import assert from 'node:assert/strict';
import { landingMarkerCandidates } from '../src/science/landingMarkers';
import type { LandingCandidate } from '../src/science/landingTypes';
import { energyPoints } from '../src/science/surfaceLayers';

test('Spacey markers retain every exact sampled coordinate, collapse repeated arrivals and obey UTC day changes', () => {
  const candidate=(latitude:number,longitude:number,arrival:string,id:string)=>({site:{id,latitude,longitude},arrival:Date.parse(arrival)}) as LandingCandidate;
  const first=candidate(10,20,'2026-11-15T00:00:00Z','first');
  const repeated=candidate(10,20,'2026-11-15T12:00:00Z','another-opportunity');
  const nearby=candidate(10+1e-8,20,'2026-11-15T23:59:59.999Z','nearby');
  const nextDay=candidate(10,20,'2026-11-16T00:00:00Z','next-day');
  const pole=candidate(-85,175,'2026-11-16T00:00:00Z','polar');
  const source=[first,repeated,nearby,nextDay,pole],snapshot=JSON.stringify(source);
  assert.deepEqual(landingMarkerCandidates(source,''),[first,nearby,pole]);
  assert.deepEqual(landingMarkerCandidates(source,'2026-11-15'),[first,nearby]);
  assert.deepEqual(landingMarkerCandidates(source,'2026-11-16'),[nextDay,pole]);
  assert.deepEqual(landingMarkerCandidates(source,'2026-11-17'),[]);
  assert.deepEqual(landingMarkerCandidates([],''),[]);
  assert.equal(JSON.stringify(source),snapshot);
});

test('Picking an energy-layer site returns the same arrival that supplied its displayed energy value', () => {
  const candidates = [
    {site:{id:'first',latitude:1,longitude:2},arrival:Date.parse('2026-11-15T01:00Z'),solarEnergy:{equivalentSunHours:100}},
    {site:{id:'better',latitude:1,longitude:2},arrival:Date.parse('2026-11-15T04:00Z'),solarEnergy:{equivalentSunHours:150}},
    {site:{id:'next-day',latitude:1,longitude:2},arrival:Date.parse('2026-11-16T01:00Z'),solarEnergy:{equivalentSunHours:200}},
    {site:{id:'no-energy',latitude:3,longitude:4},arrival:Date.parse('2026-11-15T01:00Z')},
  ] as LandingCandidate[];
  for (const day of ['', '2026-11-15', '2026-11-16']) {
    const picked = landingMarkerCandidates(candidates, day, true), points = energyPoints(candidates, day);
    assert.deepEqual(picked.map(c=>c.solarEnergy!.equivalentSunHours),points.map(p=>p.value));
  }
  assert.equal(landingMarkerCandidates(candidates,'2026-11-15')[0],candidates[0]);
});
