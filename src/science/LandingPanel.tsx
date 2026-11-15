import { useLanguage } from '../i18n/LanguageProvider';
import { landingMessages } from './landingMessages';
import { landingUiMessages } from './landingUiMessages';
import type { LandingJob } from './landingTypes';
import { downloadJSON } from './OrbitAnalysisPanel';

export default function LandingPanel({ job, day, retry, selectedSite }: {
  job: LandingJob | null; day: string; retry: () => void; selectedSite: boolean;
}) {
  const { language } = useLanguage(), c = landingMessages[language], ui = landingUiMessages[language];
  const report = job?.report;
  return <section className="orbital-analysis landing-analysis" tabIndex={-1} aria-label={c.title}><h3>{c.title}</h3>
    {!job && <p className="field-hint">{selectedSite ? c.running : c.select}</p>}
    {job?.status === 'running' && <><p role="status" className="field-hint">{c.running}</p>{job.total > 0 && <progress max={job.total} value={job.completed} />}<p className="field-hint">{job.completed} / {job.total || '…'}</p></>}
    {job?.status === 'error' && <><p role="alert" className="field-hint">{c.error}</p><button className="button" onClick={retry}>{c.retry}</button></>}
    {report && <><p className="field-hint">{c.coverage}: {report.coarseSpacingDegrees}° / ~237 m</p><p className="field-hint">{c.candidates}: {report.candidates.length}</p><p className="field-hint">{c.unknown}: {report.unverified}</p>
      <p className="field-hint">{!report.candidates.length ? c.empty : day ? ui.dayHint : `${ui.monthHint} ${ui.chooseDate}`}</p>
      <button className="text-button" onClick={() => downloadJSON(report, `landing-${report.id}.json`)}>{c.download}</button>
    </>}
  </section>;
}
