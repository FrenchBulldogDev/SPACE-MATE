import { parseQuizText } from './parseQuiz';

const texts = import.meta.glob<string>('../../Assets/txt/**/*.txt', { query: '?raw', import: 'default', eager: true });
const photos = import.meta.glob<string>('../../Assets/quiz fotos 23/**/*.{jfif,jpg,jpeg,png,webp}', { query: '?url', import: 'default', eager: true });
const numericId = (path: string) => /\/(\d+)\.[^.]+$/.exec(path)?.[1] ?? '';
const images = new Map(Object.entries(photos).map(([path, url]) => [numericId(path), url]));

// Keep the supplied Spanish text and answer key. Star markers are parsed out
// of option labels; question N always uses illustration N, in numeric order.
export const quizQuestions = Object.entries(texts).map(([path, text]) => {
  const id = numericId(path);
  return parseQuizText(id, text, images.get(id) ?? '');
}).sort((a, b) => Number(a.id) - Number(b.id));
