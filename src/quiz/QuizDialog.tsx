import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trophy, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import { quizMessages } from './messages';
import { quizQuestions } from './quizData';
import { quizScore, type QuizStatus } from './parseQuiz';

export default function QuizDialog({ open, onClose, onViewResults, status }: { open: boolean; onClose: () => void; onViewResults: () => void; status: QuizStatus }) {
  const { language } = useLanguage(), c = quizMessages[language];
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null), nextButton = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0), [answers, setAnswers] = useState<Record<string, string>>({});
  const question = quizQuestions[index], chosen = question && answers[question.id];
  const score = quizScore(quizQuestions, answers), answered = Object.keys(answers).length;
  useEffect(() => {
    if (open && !dialog.current!.open) dialog.current!.showModal();
    if (!open && dialog.current!.open) dialog.current!.close();
  }, [open]);
  useEffect(() => { if (open) heading.current?.focus(); }, [index, open]);
  useEffect(() => { if (open && chosen) nextButton.current?.focus(); }, [chosen, index, open]);
  const correct = question?.options.find(o => o.id === question.correctId);
  return <dialog ref={dialog} className="quiz-dialog" aria-labelledby="quiz-title" onCancel={onClose} onClose={onClose}>
    <header className="quiz-header"><div><span className="eyebrow">SPACE-MATE</span><h2 id="quiz-title">{c.title}</h2></div><button type="button" className="icon-button" aria-label={c.close} onClick={onClose}><X size={20} /></button></header>
    <div className="quiz-mission-status" data-status={status} role="status"><span>{c.status[status]}</span>{status === 'complete' && <button type="button" onClick={onViewResults}>{c.view} →</button>}</div>
    {language !== 'es' && <p className="quiz-language-note">{c.original}</p>}
    <div className="quiz-progress"><span>{question ? `${c.question} ${index + 1} / ${quizQuestions.length}` : c.done}</span><span>{c.score}: {score} / {answered}</span><progress value={answered} max={quizQuestions.length} aria-label={c.title} /></div>
    {question ? <>
      <div className="quiz-layout">
        <figure className="quiz-picture"><img key={question.id} src={question.image} alt={`${c.image} ${question.id}`} decoding="async" /></figure>
        <section className="quiz-question" lang="es" aria-labelledby="quiz-question-title">
          <h3 id="quiz-question-title" ref={heading} tabIndex={-1}>{question.question}</h3>
          <div className="quiz-options">{question.options.map(option => {
            const isCorrect = !!chosen && option.id === question.correctId, isWrong = chosen === option.id && !isCorrect;
            return <button type="button" key={option.id} className={`quiz-option${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`} disabled={!!chosen} onClick={() => setAnswers(previous => previous[question.id] ? previous : { ...previous, [question.id]: option.id })}>
              <span className="quiz-letter">{option.id}</span><span>{option.text}</span>{isCorrect ? <Check size={18} aria-hidden="true" /> : isWrong ? <X size={18} aria-hidden="true" /> : null}
            </button>;
          })}</div>
          {chosen && <div className="quiz-feedback" role="status" lang={language}><strong>{chosen === question.correctId ? c.correct : c.incorrect}</strong><p>{c.answer}: <span lang="es">{correct?.id}) {correct?.text}</span></p></div>}
        </section>
      </div>
      <footer className="quiz-navigation"><button type="button" className="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ArrowLeft size={16} />{c.previous}</button><button type="button" ref={nextButton} className="button primary" disabled={!chosen} onClick={() => setIndex(i => i + 1)}>{index === quizQuestions.length - 1 ? c.results : c.next}<ArrowRight size={16} /></button></footer>
    </> : <section className="quiz-result"><Trophy size={48} aria-hidden="true" /><h3 ref={heading} tabIndex={-1}>{c.done}</h3><p>{c.score}</p><strong>{score} / {quizQuestions.length}</strong><div><button type="button" className="button primary" onClick={() => { setAnswers({}); setIndex(0); }}><RotateCcw size={16} />{c.restart}</button><button type="button" className="button" onClick={onClose}>{c.close}</button></div></section>}
  </dialog>;
}
