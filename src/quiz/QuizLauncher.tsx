import { lazy, Suspense, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { quizMessages } from './messages';
import type { QuizStatus } from './parseQuiz';

const QuizDialog = lazy(() => import('./QuizDialog'));

export default function QuizLauncher({ status, onViewResults }: { status: QuizStatus; onViewResults: () => void }) {
  const { language } = useLanguage(), c = quizMessages[language];
  const [started, setStarted] = useState(false), [open, setOpen] = useState(false);
  return <>
    {(status === 'calculating' || started) && <aside className="quiz-invitation" aria-label={c.title}>
      <Sparkles size={21} aria-hidden="true" />
      <div><strong>{status === 'calculating' ? c.invitation : c.title}</strong><button type="button" onClick={() => { setStarted(true); setOpen(true); }}>{started ? c.resume : c.start} →</button></div>
    </aside>}
    {started && <Suspense fallback={<p className="quiz-loading" role="status">{c.loading}</p>}>
      <QuizDialog open={open} onClose={() => setOpen(false)} onViewResults={() => { setOpen(false); onViewResults(); }} status={status} />
    </Suspense>}
  </>;
}
