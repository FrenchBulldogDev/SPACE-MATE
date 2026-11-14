import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { parseQuizText, quizScore } from '../src/quiz/parseQuiz';
import { quizMessages } from '../src/quiz/messages';
import { LANGUAGES } from '../src/i18n/translations';

test('All 23 supplied questions have their matching image and one unambiguous starred answer', async () => {
  const folder = new URL('../Assets/txt/txt/', import.meta.url);
  const files = (await readdir(folder)).filter(f => f.endsWith('.txt')).sort((a,b) => Number(a.slice(0,-4))-Number(b.slice(0,-4)));
  assert.equal(files.length, 23);
  const expected = ['B','A','B','B','A','A','C','B','A','C','A','C','A','B','B','A','A','B','C','A','B','C','C'];
  const questions = await Promise.all(files.map(async (file,i) => {
    const id = file.slice(0,-4), image = new URL(`../Assets/quiz fotos 23/quiz fotos 23/${id}.jfif`, import.meta.url);
    await access(image);
    const question = parseQuizText(id, await readFile(new URL(file,folder),'utf8'), image.href);
    assert.equal(question.correctId,expected[i]);
    assert.equal(question.options.length,3);
    assert.ok(question.options.every(o=>!o.text.includes('*')));
    return question;
  }));
  const correct = Object.fromEntries(questions.map(q=>[q.id,q.correctId]));
  assert.equal(quizScore(questions,correct),23);
  assert.equal(quizScore(questions,{}),0);
  const partial = {...correct,'1':'A','2':'B'};
  assert.equal(quizScore(questions,partial),21);
});

test('Quiz parser preserves UTF-8, handles BOM/CRLF and rejects missing or ambiguous answer keys', () => {
  const input='\uFEFF¿Por qué?\r\n\r\nA) Primera opción.\r\n*B) Segunda opción.\r\n';
  const question = parseQuizText('1',input,'image.jfif');
  assert.equal(question.question,'¿Por qué?'); assert.equal(question.correctId,'B');
  for(const invalid of [input.replace('*',''),input.replace('A)','*A)'),input.replace('B)','A)'),input.replace('Segunda opción.','')]) assert.throws(()=>parseQuizText('1',invalid,'image.jfif'));
  assert.throws(()=>parseQuizText('1',input,''));
});

test('Quiz controls and calculation status messages cover every interface language',()=>{
  for(const {code} of LANGUAGES){
    assert.deepEqual(Object.keys(quizMessages[code]).sort(),Object.keys(quizMessages.es).sort());
    assert.deepEqual(Object.keys(quizMessages[code].status).sort(),['calculating','complete','error','idle']);
    for(const text of Object.values(quizMessages[code])) if(typeof text==='string')assert.ok(text.trim());
  }
});
