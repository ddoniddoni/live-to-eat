import { decodeViewPreferences, defaultViewPreferences, encodeViewPreferences, type ViewPreferences } from './viewPreferences';

type Storage = { read: () => Promise<string | null>; write: (raw: string) => Promise<void> };
type Snapshot = { value: ViewPreferences; ready: boolean; error: 'read' | 'write' | null };

export function createViewPreferencesStore(storage: Storage, isDemo: boolean) {
  let snapshot: Snapshot = { value: defaultViewPreferences(isDemo), ready: false, error: null };
  let hydrated = false;
  let edits: Partial<ViewPreferences> = {};
  let revision = 0;
  let active = true;
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    if (active) listeners.forEach((listener) => listener());
  };
  const hydrate = async () => {
    if (hydrated) return;
    const restored = decodeViewPreferences(await storage.read(), isDemo);
    hydrated = true;
    publish({ value: { ...restored, ...edits }, ready: true, error: null });
  };
  const synchronize = () => {
    queue = queue.then(async () => {
      try { await hydrate(); }
      catch { publish({ ready: true, error: 'read' }); return; }
      if (!Object.keys(edits).length) return;
      const writingRevision = revision;
      const raw = encodeViewPreferences(snapshot.value);
      try {
        await storage.write(raw);
        if (writingRevision === revision) { edits = {}; publish({ error: null }); }
      } catch { publish({ error: 'write' }); }
    });
    return queue;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate: () => { active = true; },
    dispose: () => { active = false; },
    synchronize,
    update(patch: Partial<ViewPreferences>) {
      if (!active) return Promise.resolve();
      const value = { ...snapshot.value, ...patch };
      if (encodeViewPreferences(value) === encodeViewPreferences(snapshot.value)) return queue;
      edits = { ...edits, ...patch };
      revision++;
      publish({ value });
      return synchronize();
    },
  };
}
