import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantMessages, FAQ_IDS } from '../src/assistant/messages';
import { matchQuestion, normalizeQuestion, translatedTurn, type AssistantTurn } from '../src/assistant/faq';
import { LANGUAGES, PROJECT_MOTTO, translations } from '../src/i18n/translations';

test('Every Spacey question and answer is translated and recognizes its own language', () => {
  for (const { code } of LANGUAGES) {
    const copy = assistantMessages[code];
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(assistantMessages.es).sort());
    assert.deepEqual(Object.keys(copy.faq), [...FAQ_IDS]);
    for (const value of Object.values(copy)) if (typeof value === 'string') assert.ok(value.trim().length > 0);
    for (const id of FAQ_IDS) {
      assert.ok(copy.faq[id].question.trim()); assert.ok(copy.faq[id].answer.trim());
      assert.equal(matchQuestion(copy.faq[id].question), id, `${code}: ${id}`);
      assert.equal(matchQuestion(normalizeQuestion(copy.faq[id].question).toUpperCase()), id);
      if (code !== 'es') { assert.notEqual(copy.faq[id].question, assistantMessages.es.faq[id].question); assert.notEqual(copy.faq[id].answer, assistantMessages.es.faq[id].answer); }
    }
  }
});

test('Spacey routes specific topics before generic usage and avoids substring false matches', () => {
  for (const query of ['¿Cómo uso el JSON científico?', 'How do I use JSON?', 'Comment utiliser le JSON ?', 'Como usar o JSON?', 'Come usare JSON?']) assert.equal(matchQuestion(query), 'json');
  for (const query of ['como usar el modo especializado', 'using specialized mode', 'utiliser le mode spécialisé', 'usar publico especializado', 'usare pubblico specializzato']) assert.equal(matchQuestion(query), 'expert');
  assert.equal(matchQuestion('Acercar la cámara con la rueda'), 'navigation');
  assert.equal(matchQuestion('QUE SIGNIFICA EL COLOR ROJO'), 'colors');
  for (const query of ['', '   ', 'hundred', 'correlation', 'unknown request 123', '<script>alert(1)</script>']) assert.equal(matchQuestion(query), null);
});

test('Changing language translates existing suggested turns and fallback without altering user-authored text', () => {
  const suggested: AssistantTurn = { id: 0, topic: 'colors' };
  const typed: AssistantTurn = { id: 1, topic: null, text: 'Mi pregunta original' };
  for (const { code } of LANGUAGES) {
    assert.deepEqual(translatedTurn(suggested, code), { question: assistantMessages[code].faq.colors.question, answer: assistantMessages[code].faq.colors.answer });
    assert.deepEqual(translatedTurn(typed, code), { question: typed.text, answer: assistantMessages[code].fallback });
  }
});

test('The project motto is fixed in Latin in all five languages', () => {
  assert.equal(PROJECT_MOTTO, 'ad astra per aspera');
  for (const { code } of LANGUAGES) {
    assert.equal(translations[code].titleLine2, PROJECT_MOTTO);
    assert.equal(translations[code].appDescription, PROJECT_MOTTO);
    assert.equal(translations[code].appTitle, `SPACE-MATE · ${PROJECT_MOTTO}`);
  }
});
