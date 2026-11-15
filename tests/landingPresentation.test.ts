import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { landingPointCloud, landingPopoverPosition } from '../src/scene/landingPointCloud';
import { landingUiMessages } from '../src/science/landingUiMessages';
import type { LandingCandidate, LandingJob } from '../src/science/landingTypes';
import LandingResultsNotice from '../src/science/LandingResultsNotice';
import LandingPanel from '../src/science/LandingPanel';
import { LanguageProvider } from '../src/i18n/LanguageProvider';

test('Monthly overview uses one circular point cloud and retains every exact site in the lunar frame', () => {
  const candidates = Array.from({ length: 2000 }, (_, i) => ({ site: { id: String(i), latitude: i % 170 - 85, longitude: i % 350 - 175 } })) as LandingCandidate[];
  candidates[0].site = { id: 'origin', latitude: 0, longitude: 0 };
  const cloud = landingPointCloud(candidates, 2);
  try {
    assert.equal(cloud.children.length, 0); assert.equal(cloud.geometry.getAttribute('position').count, 2000);
    assert.equal(cloud.material.size, 3.5); assert.equal(cloud.material.sizeAttenuation, false);
    assert.equal(cloud.material.color.getHexString(), '85e4ff'); assert.equal(cloud.material.depthTest, true);
    assert.ok(Math.abs(cloud.geometry.getAttribute('position').getX(0) - 2.016) < 1e-6);
    assert.equal(cloud.material.map!.image.width, 16); assert.equal(cloud.material.map!.image.height, 16);
    assert.equal(cloud.material.map!.image.data[3], 0);
  } finally { cloud.geometry.dispose(); cloud.material.map!.dispose(); cloud.material.dispose(); }
});

test('Site callouts stay within the viewport and switch above the anchor on narrow screens', () => {
  for (const [x,y,w,h,vw,vh] of [[470,300,300,410,955,632],[850,300,300,410,955,632],[195,340,300,280,390,680],[20,400,300,280,390,680],[900,30,300,410,955,632]]) {
    const p = landingPopoverPosition(x,y,w,h,vw,vh);
    assert.ok(p.left >= 12 && p.left + w <= vw - 12);
    assert.ok(p.top >= 12 && p.top + h <= vh - 12);
  }
  const mobile = landingPopoverPosition(195,340,300,280,390,680);
  assert.ok(mobile.top + 280 < 340); assert.equal(mobile.endY, mobile.top + 280);
});

test('Completion notice distinguishes running, successful and empty calculations; sidebar keeps no per-site description', () => {
  const candidate = { site: { id: 'sample', latitude: 1, longitude: 2 }, arrival: 1 } as LandingCandidate;
  const job = { id:'test', status:'complete', completed:16, total:16, stage:'complete', report:{id:'test',candidates:[candidate],coarseSpacingDegrees:90,unverified:0} } as LandingJob;
  const render = (element: React.ReactElement) => renderToStaticMarkup(React.createElement(LanguageProvider, null, element));
  const notice = (value: LandingJob) => render(React.createElement(LandingResultsNotice, {job:value,onChooseDate:()=>{}}));
  assert.equal(notice({...job,status:'running'}),'');
  assert.match(notice(job),/Terminó el cálculo/); assert.match(notice(job),/Seleccionar una fecha/);
  assert.match(notice({...job,report:{...job.report!,candidates:[]}}),/Ningún sitio/);
  assert.doesNotMatch(notice({...job,report:{...job.report!,candidates:[]}}),/>Seleccionar una fecha/);
  const sidebar=render(React.createElement(LandingPanel,{job,day:'',selectedSite:true,retry:()=>{}}));
  assert.doesNotMatch(sidebar,/minimum-card|solar-energy-values|Vuelo estimado/);
  assert.match(sidebar,/puntitos celestes/); assert.match(sidebar,/Descargar análisis completo/);
});

test('Landing notices and callouts have complete, nonempty copy in all five languages', () => {
  for (const copy of Object.values(landingUiMessages)) {
    assert.deepEqual(Object.keys(copy).sort(),Object.keys(landingUiMessages.en).sort());
    assert.ok(Object.values(copy).every(value=>value.trim().length>0));
  }
});
