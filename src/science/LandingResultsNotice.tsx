import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { landingUiMessages } from './landingUiMessages';
import type { LandingJob } from './landingTypes';

export default function LandingResultsNotice({ job, onChooseDate }: { job: LandingJob | null; onChooseDate: () => void }) {
  const { language } = useLanguage(), c = landingUiMessages[language];
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  if (job?.status !== 'complete' || !job.report || dismissed.has(job.report.id)) return null;
  const report = job.report;
  const dismiss = () => setDismissed(previous => new Set(previous).add(report.id));
  return <section className="landing-results-notice" role="status" aria-live="polite" aria-labelledby="landing-finished-title">
    <header><Check size={19} aria-hidden="true" /><strong id="landing-finished-title">{c.finished}</strong><button type="button" className="icon-button" aria-label={c.close} onClick={dismiss}><X size={17} /></button></header>
    <p>{report.candidates.length ? c.chooseDate : c.noSites}</p>
    {!!report.candidates.length && <button type="button" className="button primary" onClick={() => { dismiss(); onChooseDate(); }}>{c.chooseAction} →</button>}
  </section>;
}
