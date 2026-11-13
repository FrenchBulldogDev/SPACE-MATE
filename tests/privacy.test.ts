import test from 'node:test';
import assert from 'node:assert/strict';
import { clearLanguagePreference, LANGUAGE_MAX_AGE_MS, pruneLanguagePreference, readLanguagePreference, saveChosenLanguage } from '../src/i18n/languageStorage.ts';
import { LANGUAGE_STORAGE_KEY, LANGUAGES } from '../src/i18n/translations.ts';
import { privacyMessages } from '../src/privacy/messages.ts';
import { securityHeaders } from '../config/securityHeaders.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const records = new Map(Object.entries(initial));
  let writes = 0;
  return {
    records, get writes() { return writes; },
    getItem(key: string) { return records.get(key) ?? null; },
    setItem(key: string, value: string) { records.set(key, value); writes++; },
    removeItem(key: string) { records.delete(key); },
  };
}

test('Initial reads and cleanup never create a language record', () => {
  const storage = memoryStorage();
  assert.equal(readLanguagePreference(storage, 1000), null);
  pruneLanguagePreference(storage, 1000);
  assert.equal(storage.writes, 0);
  assert.equal(storage.records.size, 0);
});

test('Explicit selection stores only language and bounded validity; deletion keeps unrelated data', () => {
  const storage = memoryStorage({ unrelated: 'keep' });
  assert.equal(saveChosenLanguage('fr', storage, 1000), true);
  const record = JSON.parse(storage.getItem(LANGUAGE_STORAGE_KEY)!);
  assert.deepEqual(record, { version: 1, language: 'fr', expiresAt: 1000 + LANGUAGE_MAX_AGE_MS });
  assert.equal(readLanguagePreference(storage, 2000)?.language, 'fr');
  assert.equal(clearLanguagePreference(storage), true);
  assert.deepEqual([...storage.records], [['unrelated', 'keep']]);
});

test('Expired, malformed and legacy records are pruned without touching unrelated keys', () => {
  for (const value of ['fr', '{broken', JSON.stringify({ version: 1, language: 'de', expiresAt: 3000 }), JSON.stringify({ version: 1, language: 'fr', expiresAt: 1000 })]) {
    const storage = memoryStorage({ [LANGUAGE_STORAGE_KEY]: value, unrelated: 'keep' });
    assert.equal(readLanguagePreference(storage, 2000), null);
    pruneLanguagePreference(storage, 2000);
    assert.deepEqual([...storage.records], [['unrelated', 'keep']]);
  }
  const valid = memoryStorage();
  saveChosenLanguage('it', valid, 1000);
  pruneLanguagePreference(valid, 2000);
  assert.equal(valid.records.size, 1);
  pruneLanguagePreference(valid, 1000 + LANGUAGE_MAX_AGE_MS);
  assert.equal(valid.records.size, 0);
});

test('Blocked storage is reported without breaking language selection', () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  assert.equal(readLanguagePreference(storage), null);
  assert.equal(saveChosenLanguage('es', storage), false);
  assert.equal(clearLanguagePreference(storage), false);
  assert.doesNotThrow(() => pruneLanguagePreference(storage));
});

test('Production policy restricts sources and sensitive permissions; dev exceptions are limited to local HMR', () => {
  const production = securityHeaders();
  assert.match(production['Content-Security-Policy'], /script-src 'self';/);
  assert.match(production['Content-Security-Policy'], /connect-src 'self';/);
  assert.match(production['Content-Security-Policy'], /font-src 'self'/);
  assert.doesNotMatch(production['Content-Security-Policy'], /unsafe-eval|https:\/\//);
  assert.equal(production['Referrer-Policy'], 'no-referrer');
  assert.match(production['Permissions-Policy'], /camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  assert.match(securityHeaders(true)['Content-Security-Policy'], /ws:\/\/127\.0\.0\.1:5173/);
});

test('Privacy information is available in every supported language', () => {
  for (const { code } of LANGUAGES) {
    assert.deepEqual(Object.keys(privacyMessages[code]).sort(), Object.keys(privacyMessages.es).sort());
    assert.ok(Object.values(privacyMessages[code]).every(value => value.trim().length > 0));
  }
});
