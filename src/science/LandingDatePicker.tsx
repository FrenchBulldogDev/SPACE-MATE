import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import { daysInMonth, FIRST_MONTH, LAST_MONTH } from './calendar';
import { calendarMessages } from './calendarMessages';
import { landingMessages } from './landingMessages';
import { candidateForArrivalDay } from './landingWindows';
import type { LandingJob } from './landingTypes';

export default function LandingDatePicker({ month, day, onMonth, onDay, job, ready, selectedSite, loading, failed, invalid }: {
  month: string; day: string; onMonth: (month: string) => void; onDay: (day: string) => void;
  job: LandingJob | null; ready: boolean; selectedSite: boolean; loading: boolean; failed: boolean; invalid: boolean;
}) {
  const { language, locale } = useLanguage(), c = calendarMessages[language], l = landingMessages[language];
  const year = month.slice(0, 4), number = month.slice(5);
  const days = useMemo(() => daysInMonth(month), [month]);
  const eligible = useMemo(() => new Set(days.filter(d => candidateForArrivalDay(d, job?.report?.candidates ?? []))), [days, job?.report]);
  const complete = job?.status === 'complete' && !!job.report;
  const status = invalid ? l.invalid : failed || job?.status === 'error' ? l.error : loading ? c.loading : !selectedSite ? l.select : !complete ? c.loading : !eligible.size ? c.empty : l.choose;
  return <fieldset className="landing-calendar" aria-describedby="date-hint">
    <legend className="field-label date-label"><CalendarDays size={16} />{l.date}</legend>
    <div className="date-selects">
      <div><label htmlFor="landing-year">{c.year}</label><select id="landing-year" value={year} onChange={e => {
        let value = `${e.target.value}-${number}`;
        if (value < FIRST_MONTH) value = FIRST_MONTH;
        onMonth(value);
      }}>{Array.from({ length: Number(LAST_MONTH.slice(0, 4)) - Number(FIRST_MONTH.slice(0, 4)) + 1 }, (_, i) => String(Number(FIRST_MONTH.slice(0, 4)) + i)).map(y => <option key={y} value={y}>{y}</option>)}</select></div>
      <div><label htmlFor="landing-month">{c.month}</label><select id="landing-month" value={number} onChange={e => onMonth(`${year}-${e.target.value}`)}>{Array.from({ length: 12 }, (_, i) => {
        const value = String(i + 1).padStart(2, '0');
        return <option key={value} value={value} disabled={`${year}-${value}` < FIRST_MONTH}>{new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2000, i, 1))}</option>;
      })}</select></div>
      <div><label htmlFor="landing-day">{c.day}</label><select id="landing-day" value={day} disabled={!ready || !complete || !eligible.size} onChange={e => onDay(e.target.value)}><option value="">—</option>{days.map(d => <option key={d} value={d} disabled={!eligible.has(d)}>{Number(d.slice(8))}</option>)}</select></div>
    </div>
    <p id="date-hint" className={invalid || failed || job?.status === 'error' ? 'form-error' : 'field-hint'} role="status" aria-live="polite">{status}</p>
    <p className="field-hint">{c.range}</p>
  </fieldset>;
}
