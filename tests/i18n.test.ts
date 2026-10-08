import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, translations, isLanguage, LANGUAGE_STORAGE_KEY } from '../src/i18n/translations.ts';
import { loadSavedLanguage } from '../src/i18n/LanguageProvider.tsx';
import { LAUNCH_SITES } from '../src/config.ts';
import { LANGUAGE_MAX_AGE_MS } from '../src/i18n/languageStorage.ts';

test('Exactly the requested six languages are available with complete translations', () => {
  assert.deepEqual(LANGUAGES.map(item => item.code), ['es', 'fr', 'pt', 'it', 'en', 'ja']);
  const expected = Object.keys(translations.es).sort();
  for (const { code } of LANGUAGES) {
    assert.equal(isLanguage(code), true);
    assert.deepEqual(Object.keys(translations[code]).sort(), expected);
    for (const [key, value] of Object.entries(translations[code])) {
      if (typeof value === 'string') assert.ok(value.trim().length > 0, code + ': ' + key);
    }
    for (const site of LAUNCH_SITES) {
      assert.ok(translations[code].siteNames[site.id]);
      assert.ok(translations[code].siteRegions[site.id]);
    }
  }
  for (const invalid of ['zh', 'de', '', null, undefined, 'constructor']) assert.equal(isLanguage(invalid), false);
});

test('Saved language is restored; absent, invalid or inaccessible storage uses Spanish', () => {
  const memory = (value: string | null) => ({ getItem(key: string) { assert.equal(key, LANGUAGE_STORAGE_KEY); return value; } });
  for (const { code } of LANGUAGES) assert.equal(loadSavedLanguage(memory(JSON.stringify({ version: 1, language: code, expiresAt: Date.now() + LANGUAGE_MAX_AGE_MS }))), code);
  assert.equal(loadSavedLanguage(memory(null)), 'es');
  assert.equal(loadSavedLanguage(memory(JSON.stringify({ version: 1, language: 'zh', expiresAt: Date.now() + LANGUAGE_MAX_AGE_MS }))), 'es');
  assert.equal(loadSavedLanguage(memory('de')), 'es');
  assert.equal(loadSavedLanguage(memory('fr')), 'es'); // Legacy unbounded records are no longer reused.
  assert.equal(loadSavedLanguage({ getItem() { throw new Error('Storage disabled'); } }), 'es');
});
