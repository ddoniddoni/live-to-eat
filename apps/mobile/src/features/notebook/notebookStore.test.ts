import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeShareDraft } from '@live-to-eat/domain';
import { createDemoNotebook, emptyNotebook } from './demoData';
import { createNotebookStore } from './notebookStore';
import { RequestFailure } from '@/lib/requests/request';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const seed = createDemoNotebook();
afterEach(() => vi.useRealTimers());
const fixture = () => {
  let disk = seed;
  const write = vi.fn(async (next: typeof seed) => { disk = next; });
  const read = vi.fn(async () => ({ state: disk, total: disk.places.length }));
  const store = createNotebookStore({ initial: emptyNotebook(), read, write });
  return { store, read, write, disk: () => disk };
};

describe('notebook persistence and recovery', () => {
  it('ends a hanging load with a timeout and allows a new load', async () => {
    vi.useFakeTimers();
    const { store, read } = fixture();
    read.mockReturnValueOnce(new Promise(() => {}));
    const result = store.refresh();
    await vi.advanceTimersByTimeAsync(12000);
    expect(await result).toBe(false);
    expect(store.getSnapshot()).toMatchObject({ loading: false, loaded: false, error: 'timeout' });
    expect(await store.refresh()).toBe(true);
  });
  it('a failed write cannot poison a later queued change', async () => {
    const { store, write, disk } = fixture();
    await store.refresh();
    write.mockRejectedValueOnce(new RequestFailure('storage'));
    const failed = store.update((book) => ({ ...book, welcomed: true }));
    const next = store.update((book) => ({ ...book, locale: 'en' }));
    await expect(failed).rejects.toThrow();
    await next;
    expect(disk().welcomed).toBe(false);
    expect(disk().locale).toBe('en');
  });
  it('keeps the last confirmed records on disk and screen after save failure, then accepts edited retry', async () => {
    const { store, write, disk } = fixture();
    await store.refresh();
    write.mockRejectedValueOnce(new RequestFailure('storage'));
    await expect(store.update((book) => ({ ...book, profile: { ...book.profile, bio: 'first draft' } }))).rejects.toThrow();
    expect(store.getSnapshot().state).toEqual(seed);
    expect(disk()).toEqual(seed);
    await store.update((book) => ({ ...book, profile: { ...book.profile, bio: 'edited retry' } }));
    expect(disk().profile.bio).toBe('edited retry');
    await store.refresh();
    expect(store.getSnapshot().state.profile.bio).toBe('edited retry');
  });
  it('serializes concurrent saves and applies each edit to the last successful write', async () => {
    const { store, write, disk } = fixture();
    await store.refresh();
    const first = deferred<void>();
    write.mockImplementationOnce(async () => { await first.promise; });
    const a = store.update((book) => ({ ...book, welcomed: true }));
    const b = store.update((book) => ({ ...book, locale: 'en' }));
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().state.welcomed).toBe(false);
    first.resolve();
    await Promise.all([a, b]);
    expect(disk().welcomed).toBe(true);
    expect(disk().locale).toBe('en');
  });
  it('does not let an older refresh replace a completed edit', async () => {
    const { store, read } = fixture();
    await store.refresh();
    const stale = deferred<{ state: typeof seed; total: number }>();
    read.mockReturnValueOnce(stale.promise);
    const refresh = store.refresh();
    await Promise.resolve();
    await store.update((book) => ({ ...book, welcomed: true }));
    stale.resolve({ state: seed, total: 6 });
    expect(await refresh).toBe(false);
    expect(store.getSnapshot().state.welcomed).toBe(true);
  });
  it('retains loaded records on refresh failure and never writes after an unsuccessful initial read', async () => {
    const { store, read, write } = fixture();
    read.mockRejectedValueOnce(new Error('damaged file'));
    await store.refresh();
    expect(store.getSnapshot().loaded).toBe(false);
    await expect(store.update((book) => book)).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
    await store.refresh();
    read.mockRejectedValueOnce(new RequestFailure('offline'));
    await store.refresh();
    expect(store.getSnapshot().state).toEqual(seed);
    expect(store.getSnapshot().error).toBe('offline');
    expect(store.getSnapshot().loading).toBe(false);
  });
  it('keeps private places and shares unchanged when share persistence fails', async () => {
    const { store, write, disk } = fixture();
    await store.refresh();
    const input = { id: 'retry-share', title: 'Saved once', savedIds: [seed.places[0]!.savedId],
      regionId: 'kr', showAuthor: false, createdAt: 1, expiresAt: 2 };
    write.mockRejectedValueOnce(new RequestFailure('storage'));
    await expect(store.update((book) => makeShareDraft(book, input, true), 'share')).rejects.toThrow();
    expect(store.getSnapshot().state).toEqual(seed);
    await store.update((book) => makeShareDraft(book, input, true), 'share');
    expect(disk().shares).toHaveLength(1);
    expect(disk().places[0]?.visibility).toBe('unlisted');
  });
  it('does not publish late reads or queued writes after leaving the account', async () => {
    const { store, write } = fixture();
    await store.refresh();
    const pending = deferred<void>();
    write.mockImplementationOnce(() => pending.promise);
    const a = store.update((book) => ({ ...book, welcomed: true }));
    const b = store.update((book) => ({ ...book, locale: 'en' }));
    const rejected = expect(b).rejects.toThrow();
    const interrupted = expect(a).rejects.toThrow();
    await Promise.resolve();
    store.dispose();
    pending.resolve();
    await interrupted;
    await rejected;
    expect(store.getSnapshot().state).toEqual(seed);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
