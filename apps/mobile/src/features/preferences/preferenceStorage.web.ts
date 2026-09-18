import { preferenceStorageKey } from './viewPreferences';
import { serializePreferenceIO } from './preferenceQueue';

export function preferenceStorage(scope: string) {
  const key = preferenceStorageKey(scope);
  return {
    read: () => serializePreferenceIO(key, async () => localStorage.getItem(key)),
    write: (raw: string) => serializePreferenceIO(key, async () => { localStorage.setItem(key, raw); }),
  };
}
