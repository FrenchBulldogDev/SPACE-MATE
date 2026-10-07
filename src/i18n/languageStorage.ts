import { isLanguage, LANGUAGE_STORAGE_KEY, type Language } from './translations';

export const LANGUAGE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Preference = { version: 1; language: Language; expiresAt: number };

function parsePreference(value: string | null, now: number): Preference | null {
  if (!value) return null;
  try {
    const record: unknown = JSON.parse(value);
    if (!record || typeof record !== 'object') return null;
    const candidate = record as Partial<Preference>;
    if (candidate.version !== 1 || !isLanguage(candidate.language) || typeof candidate.expiresAt !== 'number') return null;
    if (!Number.isFinite(candidate.expiresAt) || candidate.expiresAt <= now || candidate.expiresAt > now + LANGUAGE_MAX_AGE_MS + 60000) return null;
    return candidate as Preference;
  } catch { return null; }
}

export function readLanguagePreference(storage?: Pick<Storage, 'getItem'>, now = Date.now()): Preference | null {
  try { return parsePreference((storage ?? localStorage).getItem(LANGUAGE_STORAGE_KEY), now); }
  catch { return null; }
}

export function saveChosenLanguage(language: Language, storage?: PreferenceStorage, now = Date.now()): boolean {
  if (!isLanguage(language)) return false;
  try {
    (storage ?? localStorage).setItem(LANGUAGE_STORAGE_KEY, JSON.stringify({ version: 1, language, expiresAt: now + LANGUAGE_MAX_AGE_MS }));
    return true;
  } catch { return false; }
}

export function clearLanguagePreference(storage?: Pick<Storage, 'removeItem'>): boolean {
  try { (storage ?? localStorage).removeItem(LANGUAGE_STORAGE_KEY); return true; }
  catch { return false; }
}

// Only prune our own key. Never clear unrelated browser data.
export function pruneLanguagePreference(storage?: PreferenceStorage, now = Date.now()): void {
  try {
    const target = storage ?? localStorage;
    const value = target.getItem(LANGUAGE_STORAGE_KEY);
    if (value !== null && !parsePreference(value, now)) target.removeItem(LANGUAGE_STORAGE_KEY);
  } catch { /* No persistence is required to use the application. */ }
}
