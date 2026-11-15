import { assistantMessages, FAQ_IDS, type FaqId } from './messages';
import { LANGUAGES, type Language } from '../i18n/translations';

export const normalizeQuestion = (text: string) => text.toLocaleLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

// Match complete words/phrases rather than substrings such as "red" inside
// "hundred". Consult every translation so a language change does not make a
// previous question unrecognizable; render the answer in the selected language.
export function matchQuestion(input: string): FaqId | null {
  const query = normalizeQuestion(input);
  if (!query) return null;
  const padded = ` ${query} `;
  let best: FaqId | null = null, bestScore = 0;
  for (const id of FAQ_IDS) {
    const entries = LANGUAGES.map(({ code }) => assistantMessages[code].faq[id]);
    if (entries.some(entry => normalizeQuestion(entry.question) === query)) return id;
    const keywords = new Set(entries.flatMap(entry => entry.keywords.map(normalizeQuestion)));
    let score = 0;
    for (const keyword of keywords) if (padded.includes(` ${keyword} `)) score += keyword === 'json' ? 10 : keyword.includes(' ') ? 4 : id === 'usage' ? 1 : 2;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

export type AssistantTurn = { id: number; topic: FaqId | null; text?: string };
export function translatedTurn(turn: AssistantTurn, language: Language) {
  const copy = assistantMessages[language];
  return { question: turn.text ?? (turn.topic ? copy.faq[turn.topic].question : ''),
    answer: turn.topic ? copy.faq[turn.topic].answer : copy.fallback };
}
