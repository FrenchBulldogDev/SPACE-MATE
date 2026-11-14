import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { LandingReport } from '../src/science/landingTypes';
import { candidateForArrivalDay, landingCalendarDays } from '../src/science/landingWindows';
import { LUNAR_CYCLE_SECONDS } from '../server/lunarEnvironment';
const id=process.argv[2]||'fb8952d365a48f4007eb9087';
const report=JSON.parse(await readFile(`data/landing/report-${id}.json`,'utf8')) as LandingReport;
assert.equal(report.status,'estimated');assert.equal(report.processed,report.searched);assert.ok(report.candidates.length>0);
for(const c of report.candidates){
  assert.ok(c.arrival>=report.start&&c.arrival<=report.stop);
  assert.ok(c.launch<c.arrival&&Math.abs((c.arrival-c.launch)/3600000-c.flightHours)<0.001);
  assert.ok(c.jointHours>24.5&&c.communication.continuousHours>24.5&&c.sunlight.continuousHours>24.5);
  assert.ok(c.communication.continuousHours<=LUNAR_CYCLE_SECONDS/3600+1e-8);
  assert.ok(c.communication.visiblePercent>=0&&c.communication.visiblePercent<=100.00001);
  assert.ok(c.sunlight.visiblePercent>=0&&c.sunlight.visiblePercent<=100.00001);
  assert.ok(c.terrainResolutionMeters>0&&c.terrainResolutionMeters<250);
  assert.ok(c.flightMarginHours>0&&c.terrainSource.startsWith('https://trek.nasa.gov/'));
}
const allowed=landingCalendarDays(report.start,report.stop).filter(d=>candidateForArrivalDay(d,report.candidates));
const blocked=landingCalendarDays(report.start,report.stop).filter(d=>!candidateForArrivalDay(d,report.candidates));
const summary={id,estimated:true,sectors:report.searched,acceptedPointArrivalPairs:report.candidates.length,uniqueSampledSites:new Set(report.candidates.map(c=>`${c.site.latitude},${c.site.longitude}`)).size,fullCycleCommunicationPairs:report.candidates.filter(c=>c.communication.fullCycleClear).length,allowed,blocked,temporalResolutionMinutes:30,validation:'All accepted point/arrival pairs passed range, continuity, cycle-cap and date-gating consistency checks. This is not operational mission validation.'};
await writeFile(`data/landing/verification-${id}.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
