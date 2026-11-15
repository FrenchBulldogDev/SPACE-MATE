import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageProvider';
import spaceyImage from '../../Assets/Spacy_WOBack.png';
import { assistantMessages, FAQ_IDS, type FaqId } from './messages';
import { matchQuestion, translatedTurn, type AssistantTurn } from './faq';

export default function SpaceyAssistant({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { language } = useLanguage(), c = assistantMessages[language];
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const field = useRef<HTMLInputElement>(null), launcher = useRef<HTMLButtonElement>(null), log = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false), nextId = useRef(0);
  useEffect(() => {
    if (open) field.current?.focus();
    else if (wasOpen.current) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]);
  useEffect(() => { if (open && log.current) log.current.scrollTop = log.current.scrollHeight; }, [open, turns, language]);
  const ask = (topic: FaqId | null, text?: string) => {
    const turn = { id: nextId.current++, topic, text };
    setTurns(previous => [...previous, turn].slice(-40));
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    ask(matchQuestion(question), question); setInput('');
  };
  return <div className="spacey-widget">
    <button ref={launcher} className={`icon-button spacey-launcher${open ? ' selected' : ''}`} type="button" aria-label={open ? c.close : c.open} title={open ? c.close : c.open} aria-expanded={open} aria-controls="spacey-assistant" onClick={() => onOpenChange(!open)}>
      <img src={spaceyImage} alt="" />
    </button>
    {open && <section id="spacey-assistant" className="spacey-panel" role="dialog" aria-modal="false" aria-labelledby="spacey-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onOpenChange(false); } }}>
      <header className="spacey-header"><img src={spaceyImage} alt="Spacey" /><div><h2 id="spacey-title">{c.title}</h2><p>{c.subtitle}</p></div><button className="icon-button" type="button" aria-label={c.close} onClick={() => onOpenChange(false)}><X size={17} /></button></header>
      <div className="spacey-messages" ref={log} role="log" aria-live="polite" aria-relevant="additions" aria-label={c.conversation}>
        <p className="spacey-message bot">{c.greeting}</p>
        {turns.map(turn => { const translated = translatedTurn(turn, language); return <div className="spacey-turn" key={turn.id}>
          <p className="spacey-message user">{translated.question}</p><p className="spacey-message bot">{translated.answer}</p>
        </div>; })}
      </div>
      <div className="spacey-suggestions" aria-label={c.suggestions}>{FAQ_IDS.map(id => <button type="button" key={id} onClick={() => ask(id)}>{c.faq[id].question}</button>)}</div>
      <form className="spacey-input" onSubmit={send}><label className="sr-only" htmlFor="spacey-question">{c.input}</label><input id="spacey-question" ref={field} value={input} onChange={event => setInput(event.target.value)} maxLength={500} placeholder={c.placeholder} autoComplete="off" /><button type="submit" disabled={!input.trim()} aria-label={c.send} title={c.send}><Send size={17} /></button></form>
    </section>}
  </div>;
}
