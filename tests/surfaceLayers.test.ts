import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { arrheniusFactor, thermalDegradation, dustMassFraction, parseEngineeringData, type ThermalCalibration } from '../src/science/environmentPhysics';
import { availableLayers, energyPoints, rasterValue, layerColor, weatheringScales, type RasterLayer, type SurfaceOverlay } from '../src/science/surfaceLayers';
import { surfaceMessages } from '../src/science/surfaceMessages';
import { scienceMessages } from '../src/science/messages';
import { LANGUAGES } from '../src/i18n/translations';
import { LanguageProvider } from '../src/i18n/LanguageProvider';
import SurfaceLayerPanel from '../src/science/SurfaceLayerPanel';
import { indexSolarEnergy } from '../server/solarEnergy';
import { TerrainMask, type TerrainGrid } from '../server/lunarTerrain';
import { LUNAR_CYCLE_SECONDS } from '../server/lunarEnvironment';
import type { SkySample, SurfaceTimeline } from '../server/landingSimulation';
import type { LandingCandidate } from '../src/science/landingTypes';
import { surfaceMarkers } from '../src/scene/surfaceMarkers';
import { loadPolarMaturity, polarStereographic } from '../server/polarMaturity';

// Analytical test cases only; these values are never served as observations.
const calibration: ThermalCalibration = { activationEnergyEv: 0.5, referenceKelvin: 298.15, referenceLifeHours: 100,
  minimumKelvin: 200, maximumKelvin: 450, maximumGapSeconds: 3600, source: 'https://example.org/test-calibration', mechanism: 'test mechanism' };
test('Thermal model agrees with the independent NIST Arrhenius example and reference lifetime', () => {
  const accelerated = arrheniusFactor(398.15, calibration);
  assert.ok(accelerated > 132 && accelerated < 134);
  const result = thermalDegradation([{ time: 0, kelvin: 298.15 }, { time: 3600000, kelvin: 298.15 }], calibration);
  assert.ok(Math.abs(result.equivalentHours - 1) < 1e-12);
  assert.ok(Math.abs(result.consumedLifePercent - 1) < 1e-12);
  const hot = thermalDegradation([{ time: 0, kelvin: 398.15 }, { time: 3600000, kelvin: 398.15 }], calibration);
  assert.ok(hot.consumedLifePercent > 100); // Not clamped or mislabeled as a probability.
});
test('Thermal integration handles measured ramps and refuses extrapolation, gaps and absent sources', () => {
  const samples = [{ time: 0, kelvin: 300 }, { time: 3600000, kelvin: 310 }];
  // Independent Simpson quadrature, much finer than the implementation.
  let sum = 0; const n = 10000;
  for (let i = 0; i <= n; i++) sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * Math.exp(0.5 / 8.617333262145e-5 * (1 / 298.15 - 1 / (300 + 10 * i / n)));
  const expected = sum / (3 * n);
  assert.ok(Math.abs(thermalDegradation(samples, calibration).equivalentHours - expected) / expected < 1e-5);
  assert.throws(() => thermalDegradation([{ time: 0, kelvin: 500 }, samples[1]], calibration));
  assert.throws(() => thermalDegradation([{ time: 0, kelvin: 300 }, { time: 3600001, kelvin: 300 }], calibration));
  assert.throws(() => thermalDegradation([samples[1], samples[0]], calibration));
  assert.throws(() => thermalDegradation(samples, { ...calibration, source: '' }));
});
const bins = [{ lowerMicrons: 0, upperMicrons: 20, massFraction: 0.2 }, { lowerMicrons: 20, upperMicrons: 1000, massFraction: 0.8 }];
test('Dust uses measured sieve masses and never invents the sub-bin distribution', () => {
  assert.equal(dustMassFraction(bins, 20), 0.2);
  assert.equal(dustMassFraction(bins, 1000), 1);
  assert.throws(() => dustMassFraction(bins, 10));
  assert.throws(() => dustMassFraction([bins[0]], 20));
  assert.throws(() => dustMassFraction([bins[0], { ...bins[1], lowerMicrons: 19 }], 20));
  assert.throws(() => dustMassFraction([], 20));
});
test('Scientific imports reject absent provenance, incompatible comparisons and duplicate locations', () => {
  const dust = { kind: 'dust', latitude: 0, longitude: 0, source: 'https://example.org/test-sample', measuredAt: '2020-01-01T00:00:00Z', sampleId: 'unit-test', bins, thresholdMicrons: 20 };
  assert.equal(parseEngineeringData({ version: 1, records: [dust] }).records.length, 1);
  assert.throws(() => parseEngineeringData({ version: 1, records: [{ ...dust, source: '' }] }));
  assert.throws(() => parseEngineeringData({ version: 1, records: [dust, dust] }));
  assert.throws(() => parseEngineeringData({ version: 1, records: [dust, { ...dust, latitude: 1, thresholdMicrons: 1000 }] }));
  const thermal = { kind: 'thermal', latitude: 0, longitude: 0, source: dust.source, measuredAt: dust.measuredAt, calibration, samples: [{ time: 0, kelvin: 300 }, { time: 3600000, kelvin: 300 }] };
  assert.throws(() => parseEngineeringData({ version: 1, records: [thermal, { ...thermal, latitude: 1, calibration: { ...calibration, activationEnergyEv: 0.6 } }] }));
  assert.throws(() => parseEngineeringData({ version: 1, records: [thermal, { ...thermal, latitude: 1, samples: [{ time: 1, kelvin: 300 }, { time: 3600001, kelvin: 300 }] }] }));
});

const flat: TerrainGrid = { width: 65, height: 65, west: -2, east: 2, south: -2, north: 2, heights: new Array(65 * 65).fill(0), source: 'analytical test surface', fetchedAt: 'test' };
test('Solar integral obeys the cosine law, inverse square law and clipped cycle endpoints', () => {
  const mask = new TerrainMask(flat, 0, 0), origin = mask.surface(0, 0, 2), au = 149597870700;
  try {
    for (const [distance, cosine] of [[1, 1], [2, 1], [1, 0.5]]) {
      const sky: SkySample[] = Array.from({ length: 56 * 48 + 1 }, (_, i) => ({ time: i * 1800000, earth: [0, 4e8, 0], sun: [origin[0] + au * distance * cosine, au * distance * Math.sqrt(1 - cosine * cosine), 0] }));
      const timeline: SurfaceTimeline = sky.map(s => ({ time: s.time, sunlight: true, communication: true, sunlightUnknown: false, communicationUnknown: false }));
      const calculate = indexSolarEnergy(mask, 0, 0, sky, timeline), actual = calculate(123456.789);
      const expected = LUNAR_CYCLE_SECONDS / 3600 * cosine / (distance * distance);
      assert.ok(Math.abs(actual.equivalentSunHours - expected) < 1e-8);
      assert.equal(actual.unknownHours, 0);
      const unresolved = indexSolarEnergy(mask, 0, 0, sky, timeline.map(s => ({ ...s, sunlight: false, sunlightUnknown: true })))(0);
      assert.equal(unresolved.equivalentSunHours, 0);
      assert.ok(Math.abs(unresolved.possibleSunHours - expected) < 1e-8);
      const blocked = indexSolarEnergy(mask, 0, 0, sky, timeline.map(s => ({ ...s, sunlight: false })))(0);
      assert.equal(blocked.possibleSunHours, 0);
      assert.throws(() => calculate(55 * 86400000));
    }
  } finally { mask.dispose(); }
});
test('Raster lookup respects north-up registration, the longitude seam and missing data', () => {
  const grid = { width: 4, height: 2, west: -180, east: 180, south: -50, north: 50, values: [1, null, 3, 4, 5, 6, 7, 8] } as RasterLayer;
  assert.equal(rasterValue(grid, 25, -135), 1);
  assert.equal(rasterValue(grid, -25, 135), 8);
  assert.equal(rasterValue(grid, 25, -45), null);
  assert.equal(rasterValue(grid, 51, 0), null);
  assert.equal(rasterValue(grid, -51, 0), null);
  assert.equal(rasterValue(grid, 25, 180), 1);
  assert.deepEqual(layerColor(0, 0, 100, true), layerColor(100, 0, 100, false));
});
test('Only evaluated candidates are coloured, using the selected day and best arrival at each coordinate', () => {
  const candidate = (arrival: string, value?: number) => ({ arrival: Date.parse(arrival), site: { latitude: 1, longitude: 2 }, terrainSource: 'test', solarEnergy: value === undefined ? undefined : { equivalentSunHours: value } }) as LandingCandidate;
  const candidates = [candidate('2026-11-01', 1), candidate('2026-11-01T12:00Z', 2), candidate('2026-11-02', 3), candidate('2026-11-03')];
  assert.equal(energyPoints(candidates, '2026-11-01')[0].value, 2);
  assert.equal(energyPoints(candidates, '')[0].value, 3);
  assert.deepEqual(energyPoints(candidates, '2026-11-03'), []);
});
test('General-public functions remain available and external scientific inputs are restricted to physical-scale mode', () => {
  assert.deepEqual(availableLayers('public'), ['none', 'energy', 'weathering']);
  assert.deepEqual(availableLayers('real'), ['none', 'energy', 'weathering', 'thermal', 'dust']);
  for (const mode of ['public', 'real'] as const) {
    const html = renderToStaticMarkup(createElement(LanguageProvider, null, createElement(SurfaceLayerPanel, { mode, day: '', site: null, onOverlay: () => {} })));
    assert.equal(html.includes('type="file"'), mode === 'real');
    assert.equal(html.includes('value="thermal"'), mode === 'real');
  }
  const names = ['Público especializado', 'Public spécialisé', 'Público especializado', 'Pubblico specializzato', 'Specialized public'];
  LANGUAGES.forEach(({ code }, i) => {
    assert.equal(scienceMessages[code].real, names[i]);
    assert.deepEqual(Object.keys(surfaceMessages[code]).sort(), Object.keys(surfaceMessages.en).sort());
  });
});
test('Bundled observational raster retains its official source and exact SHA-256 provenance', async () => {
  const meta = JSON.parse(await readFile('data/surface-layers/kaguya-omat-v1.json', 'utf8'));
  const bytes = await readFile('data/surface-layers/kaguya-omat-v1.tif');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256);
  assert.ok(meta.source.startsWith('https://trek.nasa.gov/moon/'));
  assert.equal(meta.metadata.pixelType, 'F32'); assert.equal(meta.metadata.bandCount, 1);
  assert.equal(meta.metadata.extent.ymin, -50); assert.equal(meta.metadata.extent.ymax, 50);
});

test('Solar site marks remain eight pixels wide, use the lunar frame, and retain their real values', () => {
  const overlay: SurfaceOverlay = { layer: 'energy', minimum: 0, maximum: 100, highIsGood: true, opacity: 0.7,
    points: [{ latitude: 0, longitude: 0, value: 0, source: 'test' }, { latitude: 90, longitude: 0, value: 100, source: 'test' }, { latitude: 0, longitude: 90, value: 50, source: 'test' }] };
  const marks = surfaceMarkers(overlay, 2), p = marks.geometry.getAttribute('position'), colors = marks.geometry.getAttribute('color');
  try {
    assert.equal(marks.material.size, 8); assert.equal(marks.material.sizeAttenuation, false); assert.equal(marks.material.depthTest, true);
    assert.equal(p.count, 3); assert.ok(Math.abs(p.getX(0) - 2.012) < 1e-6); assert.ok(Math.abs(p.getY(1) - 2.012) < 1e-6); assert.ok(Math.abs(p.getZ(2) + 2.012) < 1e-6);
    assert.ok(colors.getX(0) > colors.getY(0)); assert.ok(colors.getY(1) > colors.getX(1));
    assert.equal(overlay.points[0].value, 0);
  } finally { marks.geometry.dispose(); marks.material.dispose(); }
});

test('Spherical polar projection follows the published Moon 2000 axes in both hemispheres', () => {
  const rho = 2 * 1737400 * Math.tan(20 * Math.PI / 180);
  const near = (a: number[], b: number[]) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-8));
  near(polarStereographic(90, 25, 'north'), [0, 0]); near(polarStereographic(-90, 25, 'south'), [0, 0]);
  near(polarStereographic(50, 0, 'north'), [0, -rho]); near(polarStereographic(50, 90, 'north'), [rho, 0]);
  near(polarStereographic(-50, 0, 'south'), [0, rho]); near(polarStereographic(-50, 90, 'south'), [rho, 0]);
  assert.throws(() => polarStereographic(49, 0, 'north')); assert.throws(() => polarStereographic(-49, 0, 'south'));
});

test('Verified v2 OMAT data colour both poles without extending the equatorial calibration', async () => {
  const grids = await Promise.all([loadPolarMaturity('north'), loadPolarMaturity('south')]);
  for (const grid of grids) {
    const stem = `data/surface-layers/kaguya-sp-lola-omat-${grid.region}-v2`;
    const [text, metaText] = await Promise.all([readFile(`${stem}.grid.json`, 'utf8'), readFile(`${stem}.json`, 'utf8')]);
    const meta = JSON.parse(metaText);
    assert.equal(createHash('sha256').update(text).digest('hex'), meta.gridSha256);
    assert.equal(grid.sha256, meta.imageSha256); assert.equal(grid.archiveMd5, meta.archiveMd5);
    assert.ok(meta.source.includes('/records/7108163/')); assert.equal(meta.license, 'CC BY 4.0');
    assert.equal(grid.width, 720); assert.equal(grid.height, 80); assert.ok(meta.pixelWidthMeters > 1000 && meta.pixelWidthMeters < 1003);
    const lat = grid.region === 'north' ? 89.75 : -89.75;
    assert.ok(rasterValue(grid, lat, 0) !== null);
    assert.equal(rasterValue(grid, -lat, 0), null);
    assert.ok(rasterValue(grid, grid.region === 'north' ? 60 : -60, 90) !== null);
  }
  const equatorial = { ...grids[0], region: 'equatorial', values: [0.1, 0.2, 0.3] } as RasterLayer;
  const scales = weatheringScales([equatorial, ...grids]);
  assert.equal(scales[1].minimum, scales[2].minimum); assert.equal(scales[1].maximum, scales[2].maximum);
  assert.notEqual(scales[0].minimum, scales[1].minimum);
});
