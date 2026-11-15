import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, translations, isLanguage, LANGUAGE_STORAGE_KEY } from '../src/i18n/translations.ts';
import { loadSavedLanguage } from '../src/i18n/LanguageProvider.tsx';
import { LAUNCH_SITES } from '../src/config.ts';
import { LANGUAGE_MAX_AGE_MS } from '../src/i18n/languageStorage.ts';
import { scienceMessages } from '../src/science/messages.ts';

test('Exactly the supported five languages are available with complete translations', () => {
  assert.deepEqual(LANGUAGES.map(item => item.code), ['es', 'fr', 'pt', 'it', 'en']);
  assert.equal(LAUNCH_SITES.length, 9);
  const expected = Object.keys(translations.es).sort();
  for (const { code } of LANGUAGES) {
    assert.equal(isLanguage(code), true);
    assert.deepEqual(Object.keys(translations[code]).sort(), expected);
    for (const [key, value] of Object.entries(translations[code])) {
      if (typeof value === 'string') assert.ok(value.trim().length > 0, code + ': ' + key);
    }
    for (const site of LAUNCH_SITES) {
      assert.ok(site.name && site.region && site.source?.startsWith('https://'));
    }
    assert.equal(translations[code].teamMembers.length, 3);
    assert.equal(translations[code].collaborators.length, 2);
    for (const member of translations[code].teamMembers) {
      assert.ok(member.name.trim().length > 0);
      assert.ok(member.description.trim().length > 0);
    }
    for (const collaborator of translations[code].collaborators) assert.ok(collaborator.name.trim().length > 0);
    assert.deepEqual(Object.keys(scienceMessages[code]).sort(), Object.keys(scienceMessages.en).sort());
    assert.ok(Object.values(scienceMessages[code]).every(value => value.trim().length > 0));
  }
  for (const invalid of ['de', '', null, undefined, 'constructor']) assert.equal(isLanguage(invalid), false);
});

test('Saved language is restored; absent, invalid or inaccessible storage uses Spanish', () => {
  const memory = (value: string | null) => ({ getItem(key: string) { assert.equal(key, LANGUAGE_STORAGE_KEY); return value; } });
  for (const { code } of LANGUAGES) assert.equal(loadSavedLanguage(memory(JSON.stringify({ version: 1, language: code, expiresAt: Date.now() + LANGUAGE_MAX_AGE_MS }))), code);
  assert.equal(loadSavedLanguage(memory(null)), 'es');
  assert.equal(loadSavedLanguage(memory(JSON.stringify({ version: 1, language: 'de', expiresAt: Date.now() + LANGUAGE_MAX_AGE_MS }))), 'es');
  assert.equal(loadSavedLanguage(memory('de')), 'es');
  assert.equal(loadSavedLanguage(memory('fr')), 'es'); // Legacy unbounded records are no longer reused.
  assert.equal(loadSavedLanguage({ getItem() { throw new Error('Storage disabled'); } }), 'es');
});
