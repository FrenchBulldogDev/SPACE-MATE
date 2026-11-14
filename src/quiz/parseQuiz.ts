export type QuizOption = { id: string; text: string };
export type QuizQuestion = { id: string; question: string; options: QuizOption[]; correctId: string; image: string };
export type QuizStatus = 'idle' | 'calculating' | 'complete' | 'error';

export function parseQuizText(id: string, text: string, image: string): QuizQuestion {
  const question: string[] = [], options: QuizOption[] = [], correct: string[] = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    const option = /^(\*)?\s*([A-Z])\)\s*(.*?)\s*(\*)?$/.exec(line);
    if (option) {
      options.push({ id: option[2], text: option[3] });
      if (option[1] || option[4]) correct.push(option[2]);
    } else if (options.length) options[options.length - 1].text += ` ${line}`;
    else question.push(line);
  }
  if (!id || !image || !question.length || options.length < 2 || correct.length !== 1 || options.some(o => !o.text) || new Set(options.map(o => o.id)).size !== options.length) throw new Error(`Invalid quiz question: ${id}`);
  return { id, question: question.join(' '), options, correctId: correct[0], image };
}

export function quizScore(questions: QuizQuestion[], answers: Record<string, string>) {
  return questions.filter(q => answers[q.id] === q.correctId).length;
}
