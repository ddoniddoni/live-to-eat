import { type Notebook } from '@live-to-eat/domain';
import { createRequest, RequestFailure, type FailureKind } from '@/lib/requests/request';
import type { DemoOperation } from './demoRequests';

type Snapshot = { state: Notebook; total: number; loaded: boolean; loading: boolean; error: FailureKind | null };
type Dependencies = {
  initial: Notebook;
  read: (signal: AbortSignal) => Promise<{ state: Notebook; total: number }>;
  write: (state: Notebook, operation: DemoOperation) => Promise<void>;
};

export function createNotebookStore({ initial, read, write }: Dependencies) {
  let snapshot: Snapshot = { state: initial, total: 0, loaded: false, loading: true, error: null };
  const readers = createRequest<{ state: Notebook; total: number }>({ latest: true, timeoutMs: 12000 });
  const listeners = new Set<() => void>();
  let queue = Promise.resolve();
  let generation = 0;
  let lifetime = 0;
  let active = true;
  const publish = (patch: Partial<Snapshot>) => {
    if (!active) return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate: () => { active = true; },
    dispose: () => { active = false; generation++; lifetime++; readers.cancel(); },
    async refresh(): Promise<boolean> {
      if (!active) return false;
      const run = ++generation;
      publish({ loading: true, error: null });
      const ok = await readers.run(async (signal) => {
        await queue;
        if (signal.aborted) throw new RequestFailure('unknown');
        return read(signal);
      }, (value) => {
        if (run === generation) publish({ ...value, loaded: true });
      });
      if (run === generation) publish({ loading: false, error: readers.getSnapshot().error });
      return ok && run === generation;
    },
    update(change: (value: Notebook) => Notebook, operation: DemoOperation = 'save'): Promise<void> {
      // A failed initial read must never allow an empty notebook to replace the file.
      if (!active || !snapshot.loaded) return Promise.reject(new RequestFailure('storage'));
      generation++;
      readers.cancel();
      publish({ loading: false });
      const session = lifetime;
      const work = queue.then(async () => {
        if (!active || session !== lifetime) throw new RequestFailure('storage');
        const next = change(snapshot.state);
        await write(next, operation);
        if (!active || session !== lifetime) throw new RequestFailure('storage');
        publish({ state: next });
      });
      queue = work.catch(() => undefined);
      return work;
    },
  };
}
