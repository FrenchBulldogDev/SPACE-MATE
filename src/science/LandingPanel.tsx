import { useLanguage } from '../i18n/LanguageProvider';
import { landingMessages } from './landingMessages';
import type { LandingCandidate, LandingJob } from './landingTypes';
import { downloadJSON } from './OrbitAnalysisPanel';
import { useMemo } from 'react';
export default function LandingPanel({job,day,onCandidate,retry}:{job:LandingJob|null;day:string;onCandidate:(c:LandingCandidate)=>void;retry:()=>void}){
  const {language,locale}=useLanguage(),c=landingMessages[language];
  const report=job?.report;
  const filtered=useMemo(()=>report?.candidates.filter(p=>!day||new Date(p.arrival).toISOString().slice(0,10)===day)??[],[report,day]);
  const n=(v:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(v);
  return <section className="orbital-analysis landing-analysis"><h3>{c.title}</h3>
    {!job&&<p className="field-hint">{c.select}</p>}
    {job?.status==='running'&&<><p role="status" className="field-hint">{c.running}</p>{job.total>0&&<progress max={job.total} value={job.completed}/>}<p className="field-hint">{job.completed} / {job.total||'…'}</p></>}
    {job?.status==='error'&&<><p role="alert" className="field-hint">{c.error}</p><button className="button" onClick={retry}>{c.retry}</button></>}
    {report&&<><p className="field-hint">{c.coverage}: {report.coarseSpacingDegrees}° / ~237 m</p><p className="field-hint">{c.candidates}: {report.candidates.length}</p><p className="field-hint">{c.unknown}: {report.unverified}</p>
      {!filtered.length&&<p className="field-hint">{c.empty}</p>}
      {filtered.slice(0,60).map(p=><article className="minimum-card" key={`${p.site.id}-${p.launch}`}><strong>{p.site.name??`${p.site.latitude.toFixed(4)}°, ${p.site.longitude.toFixed(4)}°`}</strong>{p.site.name&&<small>{p.site.latitude.toFixed(4)}°, {p.site.longitude.toFixed(4)}°</small>}<time>{new Intl.DateTimeFormat(locale,{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'}).format(p.arrival)} UTC</time><small>{c.flight}: {n(p.flightHours)} ±{n(p.flightMarginHours)} {c.hours}</small><small>{c.comm}: {n(p.communication.continuousHours)} {c.hours} · {n(p.communication.visiblePercent)}%</small>{p.communication.fullCycleClear&&<small>{c.fullCycle}</small>}<small>{c.solar}: {n(p.sunlight.continuousHours)} {c.hours} · {n(p.sunlight.visiblePercent)}%</small><button className="text-button" onClick={()=>onCandidate(p)}>{c.view} →</button></article>)}
      {filtered.length>60&&<p className="field-hint">{c.more}</p>}
      <button className="text-button" onClick={()=>downloadJSON(report,`landing-${report.id}.json`)}>{c.download}</button><p className="analysis-caveat">{c.model}</p><p className="field-hint">{c.margin}</p><p className="field-hint">{c.energy}</p>
    </>}
  </section>;
}
