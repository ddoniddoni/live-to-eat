import { describe, expect, it, vi } from 'vitest';
import { createDemoNotebook } from '@/features/notebook/demoData';
import { decodeViewPreferences, defaultViewPreferences, encodeViewPreferences, preferenceStorageKey, reconcileViewPreferences } from './viewPreferences';
import { createViewPreferencesStore } from './viewPreferencesStore';
import { serializePreferenceIO } from './preferenceQueue';

const saved = { ...defaultViewPreferences(true), mapRegion: 'seoul', discoverRegion: 'jeju',
  status: 'visited' as const, folder: 'coffee', mode: 'map' as const, sort: 'name' as const };
const context = () => ({ notebook: createDemoNotebook(), completePlaces: true,
  discoverRegionIds: new Set(['kr', 'seoul', 'busan', 'jeju']), isDemo: true });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
function disk(raw: string | null = null) {
  return { read: vi.fn(async () => raw), write: vi.fn(async (next: string) => { raw = next; }) };
}

describe('view settings restoration', () => {
  it('restores all six settings after a new application instance starts', async () => {
    const storage = disk();
    const first = createViewPreferencesStore(storage, true);
    await first.synchronize();
    await first.update(saved);
    first.dispose();
    const reopened = createViewPreferencesStore(storage, true);
    await reopened.synchronize();
    expect(reopened.getSnapshot()).toEqual({ ready: true, error: null, value: saved });
  });

  it('accepts partial older settings, discards invalid fields, and never stores arbitrary data', () => {
    expect(decodeViewPreferences('{"version":1,"mode":"map","status":"private","folder":12}', true))
      .toEqual({ ...defaultViewPreferences(true), mode: 'map' });
    expect(encodeViewPreferences({ ...saved, note: 'private', access_token: 'secret' } as typeof saved))
      .toBe(JSON.stringify({ version: 1, ...saved }));
    for (const raw of ['bad json', 'null', '[]', '{"version":2,"mode":"map"}']) {
      expect(decodeViewPreferences(raw, false)).toEqual(defaultViewPreferences(false));
    }
  });

  it('falls back only for missing folders/regions and preserves the notebook', () => {
    const ctx = context();
    const before = JSON.stringify(ctx.notebook);
    expect(reconcileViewPreferences(saved, ctx)).toEqual(saved);
    expect(reconcileViewPreferences({ ...saved, folder: 'deleted', mapRegion: 'removed', discoverRegion: 'removed' }, ctx))
      .toEqual({ ...saved, folder: 'all', mapRegion: 'all', discoverRegion: 'kr' });
    expect(JSON.stringify(ctx.notebook)).toBe(before);
    expect(reconcileViewPreferences({ ...saved, mapRegion: 'unclassified' }, ctx).mapRegion).toBe('unclassified');
  });

  it('does not discard a region because the server returned only the first page', () => {
    const ctx = { ...context(), completePlaces: false, notebook: { ...createDemoNotebook(), places: [] } };
    expect(reconcileViewPreferences(saved, ctx).mapRegion).toBe('seoul');
    expect(reconcileViewPreferences(saved, { ...ctx, completePlaces: true }).mapRegion).toBe('all');
  });

  it('merges choices made during a slow initial read without overwriting other restored settings', async () => {
    const read = deferred<string | null>();
    const storage = { read: () => read.promise, write: vi.fn(async (_raw: string) => undefined) };
    const store = createViewPreferencesStore(storage, true);
    const loading = store.synchronize();
    const changing = store.update({ mode: 'list', mapRegion: 'busan' });
    read.resolve(encodeViewPreferences(saved));
    await Promise.all([loading, changing]);
    expect(store.getSnapshot().value).toEqual({ ...saved, mode: 'list', mapRegion: 'busan' });
    expect(decodeViewPreferences(storage.write.mock.calls.at(-1)?.[0] ?? null, true)).toEqual(store.getSnapshot().value);
  });

  it('keeps rapid choices in order while an earlier write is still pending', async () => {
    const firstWrite = deferred<void>();
    const storage = disk();
    const originalWrite = storage.write.getMockImplementation()!;
    storage.write.mockImplementationOnce(async (value) => { await firstWrite.promise; await originalWrite(value); });
    const store = createViewPreferencesStore(storage, true);
    await store.synchronize();
    const one = store.update({ mode: 'map' });
    await vi.waitFor(() => expect(storage.write).toHaveBeenCalledTimes(1));
    const two = store.update({ status: 'visited' });
    const three = store.update({ mode: 'list', folder: 'coffee' });
    firstWrite.resolve();
    await Promise.all([one, two, three]);
    expect(decodeViewPreferences(await storage.read(), true)).toEqual({ ...defaultViewPreferences(true), status: 'visited', folder: 'coffee' });
  });

  it('keeps the original file on a read failure and merges current choices after retry', async () => {
    const storage = disk(encodeViewPreferences(saved));
    storage.read.mockRejectedValue(new Error('storage unavailable'));
    const store = createViewPreferencesStore(storage, true);
    await store.synchronize();
    expect(store.getSnapshot()).toMatchObject({ ready: true, error: 'read' });
    await store.update({ mapRegion: 'busan' });
    expect(storage.write).not.toHaveBeenCalled();
    storage.read.mockResolvedValue(encodeViewPreferences(saved));
    await store.synchronize();
    expect(store.getSnapshot()).toMatchObject({ error: null, value: { ...saved, mapRegion: 'busan' } });
  });

  it('retains the on-screen choice on write failure and saves it on retry', async () => {
    const storage = disk(encodeViewPreferences(saved));
    storage.write.mockRejectedValueOnce(new Error('disk full'));
    const store = createViewPreferencesStore(storage, true);
    await store.synchronize();
    await store.update({ mode: 'list' });
    expect(store.getSnapshot()).toMatchObject({ error: 'write', value: { mode: 'list' } });
    expect(decodeViewPreferences(await storage.read(), true).mode).toBe('map');
    await store.synchronize();
    expect(store.getSnapshot().error).toBeNull();
    expect(decodeViewPreferences(await storage.read(), true).mode).toBe('list');
  });

  it('uses defaults for damaged settings without changing the file until a user selects a setting', async () => {
    const storage = disk('{broken');
    const store = createViewPreferencesStore(storage, true);
    await store.synchronize();
    expect(store.getSnapshot().value).toEqual(defaultViewPreferences(true));
    expect(storage.write).not.toHaveBeenCalled();
    await store.update({ sort: 'name' });
    expect(decodeViewPreferences(await storage.read(), true).sort).toBe('name');
  });

  it('finishes an already requested save without notifying an unmounted screen', async () => {
    const storage = disk();
    const store = createViewPreferencesStore(storage, true);
    await store.synchronize();
    const listener = vi.fn();
    store.subscribe(listener);
    const writing = store.update({ mode: 'map' });
    listener.mockClear();
    store.dispose();
    await writing;
    await store.update({ mode: 'list' });
    expect(listener).not.toHaveBeenCalled();
    expect(decodeViewPreferences(await storage.read(), true).mode).toBe('map');
  });

  it('isolates demo and account keys and rejects unsafe file names', () => {
    expect(new Set(['demo', 'account-a', 'account-b'].map(preferenceStorageKey)).size).toBe(3);
    for (const scope of ['', '../demo', 'account-a/b', 'account-a?b']) expect(() => preferenceStorageKey(scope)).toThrow();
  });

  it('serializes same-account IO across remounts and recovers the queue after failure', async () => {
    const slow = deferred<void>();
    const events: string[] = [];
    const oldWrite = serializePreferenceIO('a', async () => { await slow.promise; events.push('write'); throw new Error('failed'); });
    const handled = oldWrite.catch(() => undefined);
    const newRead = serializePreferenceIO('a', async () => { events.push('read'); });
    await serializePreferenceIO('b', async () => { events.push('other account'); });
    expect(events).toEqual(['other account']);
    slow.resolve();
    await Promise.all([handled, newRead]);
    expect(events).toEqual(['other account', 'write', 'read']);
  });
});
