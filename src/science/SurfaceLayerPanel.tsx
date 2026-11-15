import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Layers3, Minus } from 'lucide-react';
import type { DisplayMode } from './types';
import type { LandingJob, LandingReport, LunarSite } from './landingTypes';
import { availableLayers, energyPoints, rasterValue, weatheringScales, type RasterLayer, type SurfaceLayer, type SurfaceOverlay } from './surfaceLayers';
import { dustMassFraction, parseEngineeringData, thermalDegradation, type EngineeringData } from './environmentPhysics';
import { useLanguage } from '../i18n/LanguageProvider';
import { surfaceMessages } from './surfaceMessages';
import { downloadJSON } from './OrbitAnalysisPanel';

const specification = {
  version: 1,
  instructions: 'Supply real measurements and laboratory calibration only. This specification contains no example measurements. All fields are mandatory. Records are points, with no inferred spatial coverage. Values are SI unless the field name specifies units. All thermal records must use the same calibration and start/end times; all dust records must use the same sieve threshold.',
  records: [],
  recordFields: { kind: 'thermal or dust', latitude: 'number, degrees north −90…90', longitude: 'number, degrees east −180…180', source: 'HTTPS measurement archive or report URL', measuredAt: 'ISO 8601 measurement date' },
  thermalFields: { samples: 'At least two {time: UTC Unix milliseconds, kelvin: equipment temperature}, in increasing order, inside the calibrated range.',
    calibration: { activationEnergyEv: 'Positive, measured for this failure mechanism (eV)', referenceKelvin: 'Reference test temperature (K)', referenceLifeHours: 'Measured life to the specified endpoint at the reference temperature (h)', minimumKelvin: 'Minimum validated temperature (K)', maximumKelvin: 'Maximum validated temperature (K)', maximumGapSeconds: 'Largest sampling gap justified by the measurement system (s)', source: 'HTTPS calibration report URL', mechanism: 'Failure mechanism and endpoint identified by the test' } },
  dustFields: { sampleId: 'Physical sample identifier', thresholdMicrons: 'Measured sieve boundary (µm)', bins: 'Sorted, nonoverlapping {lowerMicrons, upperMicrons, massFraction}; fractions of the complete sample must sum to 1. Threshold cannot cut a bin. No interpolation or assumed distribution.' },
};
export default function SurfaceLayerPanel({ mode, report, day, site, onOverlay, job, hasLaunchSite = false, onFocusMoon, onConfigure, retryAnalysis, minimized, onMinimizedChange }: {
  mode: DisplayMode; report?: LandingReport; day: string; site: LunarSite | null; onOverlay: (overlay: SurfaceOverlay | null) => void;
  job?: LandingJob | null; hasLaunchSite?: boolean; onFocusMoon?: () => void; onConfigure?: () => void; retryAnalysis?: () => void;
  minimized?: boolean; onMinimizedChange?: (value: boolean) => void;
}) {
  const { language, locale } = useLanguage(), c = surfaceMessages[language];
  const [selected, setSelected] = useState<SurfaceLayer>('none');
  const [opacity, setOpacity] = useState(0.7);
  const [rasters, setRasters] = useState<RasterLayer[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [retry, setRetry] = useState(0);
  const [external, setExternal] = useState<EngineeringData>();
  const [invalid, setInvalid] = useState(false);
  const [internalMinimized, setInternalMinimized] = useState(false);
  const compact = minimized ?? internalMinimized;
  const layerLauncher = useRef<HTMLButtonElement>(null), layerSelect = useRef<HTMLSelectElement>(null);
  const changeMinimized = (value: boolean) => {
    setInternalMinimized(value); onMinimizedChange?.(value);
    requestAnimationFrame(() => value ? layerLauncher.current?.focus() : layerSelect.current?.focus());
  };
  const allowed = availableLayers(mode), layer = allowed.includes(selected) ? selected : 'none';
  useEffect(() => { if (!availableLayers(mode).includes(selected)) setSelected('none'); }, [mode, selected]);
  useEffect(() => {
    if (layer !== 'weathering' || rasters.length) return;
    const controller = new AbortController();
    setStatus('loading');
    void fetch('/api/surface-layer?layer=weathering&coverage=global', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error();
      const data: { version: number; layers: RasterLayer[] } = await response.json();
      if (data.version !== 2 || !Array.isArray(data.layers) || data.layers.length !== 3 || data.layers.some(grid => grid.version !== 1 || grid.width !== 720 || ![80, 200].includes(grid.height) || grid.values.length !== grid.width * grid.height || grid.units !== 'OMAT')) throw Error();
      if (!controller.signal.aborted) { setRasters(data.layers); setStatus('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [layer, rasters, retry]);
  const scales = useMemo(() => weatheringScales(rasters), [rasters]);
  const importedPoints = useMemo(() => external?.records.map(r => ({ latitude: r.latitude, longitude: r.longitude, source: r.source,
    kind: r.kind, measuredAt: r.measuredAt,
    value: r.kind === 'thermal' ? thermalDegradation(r.samples, r.calibration).consumedLifePercent : 100 * dustMassFraction(r.bins, r.thresholdMicrons),
  })) ?? [], [external]);
  const overlay = useMemo<SurfaceOverlay | null>(() => {
    if (layer === 'none') return null;
    const points = layer === 'energy' ? energyPoints(report?.candidates ?? [], day) : importedPoints.filter(p => p.kind === layer);
    const values = points.map(p => p.value);
    const minimum = layer === 'weathering' ? scales[0]?.minimum ?? 0 : 0;
    const maximum = layer === 'weathering' ? scales[0]?.maximum ?? 1 : layer === 'dust' || layer === 'thermal' ? 100 : Math.max(1, ...values);
    return { layer, points, rasters: layer === 'weathering' ? scales : undefined, minimum, maximum, highIsGood: layer === 'energy' || layer === 'weathering', opacity };
  }, [layer, report, day, scales, importedPoints, opacity]);
  useEffect(() => { onOverlay(overlay); }, [overlay, onOverlay]);
  useEffect(() => { if (layer === 'energy' && report?.candidates.some(p => p.solarEnergy)) onFocusMoon?.(); }, [layer, report?.id]);
  const number = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(v);
  const dustRecord = external?.records.find(r => r.kind === 'dust');
  const units = layer === 'energy' ? c.energyUnit : layer === 'weathering' ? 'OMAT' : layer === 'dust' && dustRecord?.kind === 'dust' ? `% (≤${number(dustRecord.thresholdMicrons)} µm)` : '%';
  const note = layer === 'energy' ? c.energyHint : layer === 'weathering' ? c.weatheringHint : layer === 'thermal' ? c.thermalHint : c.dustHint;
  const legend = layer === 'energy' ? c.goodEnergy : layer === 'weathering' ? c.goodWeathering : layer === 'thermal' ? c.goodThermal : c.goodDust;
  const selectedValue = site && overlay ? overlay.rasters ? overlay.rasters.map(s => rasterValue(s.raster, site.latitude, site.longitude)).find(v => v !== null) ?? null : overlay.points.find(p => p.latitude === site.latitude && p.longitude === site.longitude)?.value ?? null : null;
  const activeRecords = importedPoints.filter(p => p.kind === layer);
  return <section className={`surface-layer-panel${compact ? ' is-minimized' : ''}`} aria-labelledby="surface-layer-title">
    {compact && <button ref={layerLauncher} className="icon-button surface-layer-launcher" type="button" aria-label={c.expand} title={c.expand} aria-expanded={false} aria-controls="surface-layer-controls" onClick={() => changeMinimized(false)}><Layers3 size={20} aria-hidden="true" /></button>}
    <div id="surface-layer-controls" hidden={compact}>
    <header className="surface-layer-heading"><h3 id="surface-layer-title"><Layers3 size={15} aria-hidden="true" />{c.title}</h3><div className="surface-layer-actions"><button className="icon-button" type="button" onClick={onFocusMoon} aria-label={c.focusMoon} title={c.focusMoon}><Crosshair size={16} /></button><button className="icon-button" type="button" onClick={() => changeMinimized(true)} aria-label={c.minimize} title={c.minimize} aria-expanded={true} aria-controls="surface-layer-controls"><Minus size={16} /></button></div></header>
    <label className="sr-only" htmlFor="surface-layer">{c.title}</label>
    <select ref={layerSelect} id="surface-layer" value={layer} onChange={e => { setSelected(e.target.value as SurfaceLayer); if (e.target.value !== 'none') onFocusMoon?.(); }}>
      {allowed.map(value => <option key={value} value={value} disabled={(value === 'thermal' || value === 'dust') && !importedPoints.some(p => p.kind === value)}>{c[value]}</option>)}
    </select>
    {layer === 'energy' && !!overlay?.points.length && <p className="surface-layer-count" role="status">{overlay.points.length} {c.samples} · {c.goodEnergy}</p>}
    {layer === 'weathering' && <p className="surface-layer-count">{c.calibrationNote}</p>}
    {layer === 'weathering' && status === 'loading' && <p className="surface-layer-status" role="status">{c.loading}</p>}
    {layer === 'weathering' && status === 'error' && <p className="surface-layer-status" role="alert">{c.error} <button className="text-button" onClick={() => setRetry(n => n + 1)}>{c.retry}</button></p>}
    {layer === 'energy' && !overlay?.points.length && <div className="surface-layer-status" role="status">
      {!hasLaunchSite ? <><p>{c.selectLaunch}</p><button className="text-button" onClick={onConfigure}>{c.configureLaunch} →</button></>
        : job?.status === 'error' ? <><p>{c.analysisError}</p><button className="text-button" onClick={retryAnalysis}>{c.retry}</button></>
          : job?.status !== 'complete' ? <><p>{c.energyCalculating}</p>{!!job?.total && <progress max={job.total} value={job.completed} />}<small>{job?.completed ?? 0} / {job?.total || '…'}</small></>
            : <p>{c.noEnergy}</p>}
    </div>}
    {(layer !== 'none' || mode === 'real') && <details className="surface-layer-details"><summary>{layer === 'none' ? c.import : c.details}</summary><div className="surface-layer-scroll">
    {layer !== 'none' && <>
      <p className="field-hint">{note}</p>
      {overlay && <>
        {layer === 'weathering' ? scales.map(scale => <div className="surface-legend" key={scale.raster.source}><strong>{scale.raster.region === 'north' ? c.northPolar : scale.raster.region === 'south' ? c.southPolar : c.equatorial} · OMAT</strong><div className="surface-gradient" aria-hidden="true" /><div className="surface-range"><span>{number(scale.minimum)}</span><span>{number(scale.maximum)}</span></div><p>{legend}</p></div>) : <div className="surface-legend"><strong>{c.basis} · {units}</strong><div className={overlay.highIsGood ? 'surface-gradient' : 'surface-gradient reversed'} aria-hidden="true" /><div className="surface-range"><span>{number(overlay.minimum)}</span><span>{number(overlay.maximum)}</span></div><p>{legend}</p></div>}
        <p className="field-hint">{c.noData}: <span className="surface-no-data" aria-hidden="true" /> —</p>
        {layer !== 'weathering' && <p className="field-hint">{overlay.points.length} {c.samples}. {c.pointsHint}</p>}
        {site && <p className="surface-value">{c.selected}: <strong>{selectedValue === null ? c.noData : `${number(selectedValue)} ${units}`}</strong></p>}
      </>}
      <label className="field-hint" htmlFor="surface-opacity">{c.opacity} · {Math.round(opacity * 100)}%</label><input id="surface-opacity" type="range" min="0.15" max="0.95" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} />
      {layer === 'weathering' && rasters.map(raster => <div key={raster.source}><a className="site-source" href={raster.citation} target="_blank" rel="noreferrer">{raster.region === 'north' ? c.northPolar : raster.region === 'south' ? c.southPolar : 'Kaguya MI / USGS'} · {c.source} ↗</a><small className="field-hint">SHA-256: {raster.sha256}</small></div>)}
      {layer === 'weathering' && !!rasters.length && <button className="text-button" onClick={() => downloadJSON({ version: 2, layers: rasters }, 'kaguya-omat-global.json')}>{c.download}</button>}
      {activeRecords.slice(0, 30).map((record, i) => <div className="surface-record" key={i}><strong>{number(record.latitude)}°, {number(record.longitude)}° · {number(record.value)}%</strong><small>{c.period}: {record.measuredAt}</small><a href={record.source} target="_blank" rel="noreferrer">{c.source} ↗</a></div>)}
    </>}
    {mode === 'real' && <div className="surface-import"><p className="field-hint">{c.thermalHint}</p><p className="field-hint">{c.dustHint}</p><p className="field-hint">{c.noExternal}</p>
      <label className="field-label" htmlFor="scientific-data">{c.import}</label><input id="scientific-data" type="file" accept="application/json,.json" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        try {
          if (file.size > 5 * 1024 * 1024) throw Error('File too large');
          const data = parseEngineeringData(JSON.parse(await file.text()));
          setExternal(data); setInvalid(false); setSelected(data.records[0].kind);
        } catch { setInvalid(true); }
      }} />
      {invalid && <p className="form-error" role="alert">{c.invalid}</p>}
      {external && <><p className="field-hint">{c.imported}: {external.records.length}</p><button className="text-button" onClick={() => { setExternal(undefined); setSelected('none'); }}>{c.clear}</button></>}
      <button className="text-button" onClick={() => downloadJSON(specification, 'scientific-input-specification.json')}>{c.schema}</button><p className="field-hint">{c.privacy}</p>
    </div>}
    </div></details>}
    </div>
  </section>;
}
