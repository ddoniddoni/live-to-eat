import { File, Paths } from 'expo-file-system';
import { preferenceStorageKey } from './viewPreferences';
import { serializePreferenceIO } from './preferenceQueue';

export function preferenceStorage(scope: string) {
  const key = preferenceStorageKey(scope);
  return {
    read: () => serializePreferenceIO(key, async () => {
      const file = new File(Paths.document, `${key}.json`);
      return file.exists ? file.text() : null;
    }),
    write: (raw: string) => serializePreferenceIO(key, async () => {
      const file = new File(Paths.document, `${key}.json`);
      const temporary = new File(Paths.document, `${key}.tmp`);
      temporary.write(raw);
      await temporary.move(file, { overwrite: true });
    }),
  };
}
