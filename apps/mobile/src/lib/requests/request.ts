export type FailureKind = 'offline' | 'timeout' | 'storage' | 'unknown';
export class RequestFailure extends Error {
  constructor(readonly kind: FailureKind) { super(kind); }
}
export const failureKind = (error: unknown): FailureKind =>
  error instanceof RequestFailure ? error.kind : 'unknown';

// Reads may time out. Aborting a client wait cannot undo an accepted write;
// mutation callers use no timeout and wait for the underlying write to settle.
export function createRequest<T>({ latest = false, timeoutMs = 0 } = {}) {
  let snapshot: { busy: boolean; error: FailureKind | null } = { busy: false, error: null };
  let active: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: typeof snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const cancel = () => {
    const previous = active;
    active = null;
    previous?.abort();
    publish({ busy: false, error: null });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancel,
    async run<Result = T>(work: (signal: AbortSignal) => Promise<Result>, onSuccess?: (value: Result) => void): Promise<boolean> {
      if (active && !latest) return false;
      active?.abort();
      const controller = new AbortController();
      active = controller;
      publish({ busy: true, error: null });
      let timedOut = false;
      const timer = timeoutMs > 0 ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs) : null;
      let stopListening = () => {};
      try {
        const interrupted = new Promise<never>((_, reject) => {
          const abort = () => reject(new RequestFailure(timedOut ? 'timeout' : 'unknown'));
          controller.signal.addEventListener('abort', abort, { once: true });
          stopListening = () => controller.signal.removeEventListener('abort', abort);
        });
        const value = await Promise.race([work(controller.signal), interrupted]);
        if (active !== controller) return false;
        onSuccess?.(value);
        return true;
      } catch (error) {
        if (active === controller) publish({ busy: false, error: failureKind(error) });
        return false;
      } finally {
        if (timer !== null) clearTimeout(timer);
        stopListening();
        if (active === controller) { active = null; publish({ ...snapshot, busy: false }); }
      }
    },
  };
}
