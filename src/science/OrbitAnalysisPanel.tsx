import { useEffect, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import type { LaunchSite } from '../config';
import { useLanguage } from '../i18n/LanguageProvider';
import { scienceMessages } from './messages';
import type { Ephemeris, ProximityMinimum, ProximityReport } from './types';

export function downloadJSON(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OrbitAnalysisPanel({ data, status, retry, site, onInstant }: {
  data: Ephemeris | null; status: 'loading' | 'ready' | 'error'; retry: () => void;
  site: LaunchSite | null; onInstant: (time: number) => void;
}) {
  const { language, locale } = useLanguage();
  const c = scienceMessages[language];
  const [result, setResult] = useState<{ report: ProximityReport | null; status: 'idle' | 'loading' | 'ready' | 'error' }>({ report: null, status: 'idle' });
  useEffect(() => {
    setResult({ report: null, status: data && site ? 'loading' : 'idle' });
    if (!data || !site) return;
    const worker = new Worker(new URL('./proximity.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = event => setResult({ report: event.data.report ?? null, status: event.data.report ? 'ready' : 'error' });
    worker.onerror = () => setResult({ report: null, status: 'error' });
    worker.postMessage({ data, site });
    return () => worker.terminate();
  }, [data, site]);
  const number = (value: number, digits = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  const time = (timestamp: number) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'medium' }).format(timestamp);
  const minimumCard = (p: ProximityMinimum, key: string) => <div className="minimum-card" key={key}>
    <time dateTime={new Date(p.time).toISOString()}>{time(p.time)} UTC</time>
    <strong>ρ = {number(p.rhoMeters / 1000)} km</strong>
    <small className={p.aboveHorizon ? 'above-horizon' : ''}>{p.aboveHorizon ? c.above : c.below} · {number(p.elevationDegrees)}°</small>
    <button className="text-button" onClick={() => onInstant(p.time)}>{c.view} →</button>
  </div>;
  return <section className="orbital-analysis" aria-label={c.ephemeris}>
    <h3>{c.ephemeris}</h3>
    <p className="field-hint">{c.frame}</p>
    {status === 'loading' && <p className="analysis-status" role="status"><LoaderCircle className="loading-icon" size={16} />{c.loading}</p>}
    {status === 'error' && <><p className="field-hint" role="alert">{c.apiError}</p><button className="button" onClick={retry}>{c.retry}</button></>}
    {data && <>
      <p className="ephemeris-period"><time>{time(data.start)}</time><span>→</span><time>{time(data.stop)} UTC</time></p>
      <p className="field-hint">{c.sampleCount}</p>
      <div className="analysis-actions"><button className="text-button" onClick={() => downloadJSON(data, `moon-ephemeris-${data.id}.json`)}><Download size={14} />{c.download}</button><button className="text-button" onClick={retry}>{c.refresh}</button></div>
      <details className="daily-data"><summary>{c.daily}</summary><div className="data-scroll"><table><thead><tr><th>{c.time}</th><th>{c.ra}</th><th>{c.dec}</th><th>{c.radius}</th></tr></thead><tbody>{data.daily.map(p => <tr key={p.time}><td>{new Date(p.time).toISOString().slice(0, 16).replace('T', ' ')}</td><td>{number(p.spherical.rightAscensionRadians * 180 / Math.PI, 4)}</td><td>{number(p.spherical.declinationRadians * 180 / Math.PI, 4)}</td><td>{number(p.spherical.radiusMeters / 1000)}</td></tr>)}</tbody></table></div></details>
      <h3 className="analysis-heading">{c.analysis}</h3>
      <p className="field-hint">{c.definition}</p>
      {!site && <p className="field-hint">{c.selectSite}</p>}
      {result.status === 'loading' && <p className="analysis-status" role="status"><LoaderCircle className="loading-icon" size={16} />{c.calculating}</p>}
      {result.status === 'error' && <p role="alert" className="field-hint">{c.calculationError}</p>}
      {result.report && <>
        <p className="minimum-heading">{c.global}</p>
        {result.report.globalIsBoundary && <p className="field-hint">{c.boundary}</p>}
        {minimumCard(result.report.global, 'global')}
        <details className="minimum-list"><summary>{c.minima} ({result.report.minima.length})</summary>{result.report.minima.length ? result.report.minima.map((p, i) => minimumCard(p, String(i))) : <p>{c.none}</p>}</details>
        <button className="text-button" onClick={() => downloadJSON({ schemaVersion: 1, ephemeris: { id: data.id, start: data.start, stop: data.stop, source: data.source, queries: data.queries, fetchedAt: data.fetchedAt }, site, moonSurfaceModel: { shape: 'sphere', radiusMeters: 1737400 }, report: result.report, limitations: c.caveat }, `proximity-${data.id}-${site!.id}.json`)}><Download size={14} />{c.export}</button>
        <p className="field-hint">{c.numerical}</p>
      </>}
      <p className="analysis-caveat">{c.caveat}</p>
    </>}
  </section>;
}
