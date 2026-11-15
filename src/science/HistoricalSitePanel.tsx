import { useEffect, useRef, useState } from 'react';
import { Flag, LoaderCircle, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import type { LaunchSite } from '../config';
import type { Ephemeris } from './types';
import type { HistoricalFlight } from './flightHistory';
import type { LandingJob } from './landingTypes';
import { historicalSiteCandidate, type HistoricalSiteSnapshot } from './historicalSites';
import { historicalMessages } from './historicalMessages';

export default function HistoricalSitePanel({ mission, time, ephemeris, launchSite, job, day, onClose, onRefresh }: {
  mission: HistoricalFlight; time: number; ephemeris: Ephemeris | null; launchSite: LaunchSite | null;
  job: LandingJob | null; day: string; onClose: () => void; onRefresh: () => void;
}) {
  const { language, locale } = useLanguage(), c = historicalMessages[language];
  const [historical, setHistorical] = useState(false), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; snapshot?: HistoricalSiteSnapshot; error?: boolean }>();
  const title = useRef<HTMLHeadingElement>(null);
  const key = `${ephemeris?.id}:${ephemeris?.fetchedAt}:${mission.id}:${time}:${retry}`;
  const snapshot = result?.key === key ? result.snapshot : undefined;
  const failed = result?.key === key && result.error;
  useEffect(() => {
    const previous = document.activeElement;
    title.current?.focus({ preventScroll: true });
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (historical || !ephemeris || time < ephemeris.start || time > ephemeris.stop) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ ephemeris: ephemeris.id, mission: mission.id, time: String(time) });
    void fetch(`/api/historical-site?${params}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Site unavailable');
      const data: HistoricalSiteSnapshot = await response.json();
      if (data.missionId !== mission.id || data.time !== time) throw Error('Wrong site or instant');
      if (!controller.signal.aborted) setResult({ key, snapshot: data });
    }).catch(() => { if (!controller.signal.aborted) setResult({ key, error: true }); });
    return () => controller.abort();
  }, [key, historical]);
  const number = (value: number, digits = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const date = (value: string | number) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  const candidate = historicalSiteCandidate(mission, job?.report?.candidates ?? [], day, time);
  const stateText = (value: HistoricalSiteSnapshot['communication']) => c[value];
  return <section className="historical-site-panel" aria-labelledby="historical-site-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <header><Flag size={18} aria-hidden="true" /><div><span>{c.title}</span><h2 id="historical-site-title" tabIndex={-1} ref={title}>{mission.id}</h2></div><button className="icon-button" onClick={onClose} aria-label={c.close}><X size={17} /></button></header>
    <div className="historical-site-scroll">
      <p className="historical-touchdown"><span>{c.landed}</span><time dateTime={mission.landing}>{date(mission.landing)}</time></p>
      <label className="toggle-row historical-switch" htmlFor="historical-data-toggle"><span>{c.historical}</span><input role="switch" id="historical-data-toggle" type="checkbox" checked={historical} onChange={event => setHistorical(event.target.checked)} /><span className="switch-track" aria-hidden="true" /></label>
      <h3>{historical ? c.history : c.current}</h3>
      <dl className="historical-site-values">
        <div><dt>{c.coordinates}</dt><dd>{number(mission.latitude, 5)}°, {number(mission.longitude, 5)}°</dd></div>
        {historical ? <>
          <div><dt>{c.mission}</dt><dd>{mission.id}</dd></div><div><dt>{c.nation}</dt><dd>{mission.nation}</dd></div>
          <div><dt>{c.launch}</dt><dd><time dateTime={mission.launch}>{date(mission.launch)}</time></dd></div>
          <div><dt>{c.flight}</dt><dd>{number((Date.parse(mission.landing) - Date.parse(mission.launch)) / 3600000)} {c.hours}</dd></div>
        </> : <>
          <div><dt>{c.at}</dt><dd><time dateTime={new Date(time).toISOString()}>{date(time)}</time></dd></div>
          <div><dt>{c.launchSite}</dt><dd>{launchSite?.name ?? c.noLaunch}</dd></div>
          {snapshot && <>
            <div><dt>{c.communication}</dt><dd data-visibility={snapshot.communication}>{stateText(snapshot.communication)}</dd></div>
            <div><dt>{c.sunlight}</dt><dd data-visibility={snapshot.sunlight}>{stateText(snapshot.sunlight)}</dd></div>
            <div><dt>{c.earthElevation}</dt><dd>{number(snapshot.earthElevationDegrees)}°</dd></div>
            <div><dt>{c.sunElevation}</dt><dd>{number(snapshot.sunElevationDegrees)}°</dd></div>
            <div><dt>{c.distance}</dt><dd>{number(snapshot.earthDistanceKm)} km</dd></div>
          </>}
          {candidate && <><div><dt>{c.arrival}</dt><dd>{date(candidate.arrival)}</dd></div><div><dt>{c.estimatedFlight}</dt><dd>{number(candidate.flightHours)} ± {number(candidate.flightMarginHours)} {c.hours}</dd></div></>}
        </>}
      </dl>
      {historical ? <p className="historical-site-note">{c.historyNote}</p> : <>
        {!snapshot && <p className="historical-site-status" role={failed ? 'alert' : 'status'}>{failed ? c.error : <><LoaderCircle size={15} className="loading-icon" />{c.loading}</>}</p>}
        {failed && <button className="text-button" onClick={() => setRetry(n => n + 1)}>{c.retry}</button>}
        <button className="text-button" onClick={onRefresh}>{c.refresh} ↻</button>
        {!candidate && <p className="historical-site-note">{!launchSite ? c.selectLaunch : job?.status === 'error' ? c.analysisError : job?.status !== 'complete' ? c.waiting : c.noCandidate}</p>}
        {snapshot && <a className="site-source" href={snapshot.terrainSource} target="_blank" rel="noreferrer">{c.terrain} · ~{number(snapshot.terrainResolutionMeters, 0)} m ↗</a>}
        <p className="historical-site-note">{c.note}</p>
      </>}
      <div className="historical-site-sources"><a href={mission.source} target="_blank" rel="noreferrer">{c.source} ↗</a><a href={mission.coordinateSource} target="_blank" rel="noreferrer">{c.coordinateSource} ↗</a></div>
    </div>
  </section>;
}
