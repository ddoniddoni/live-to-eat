// A new screen for the same account must wait for writes from the previous screen.
const queues = new Map<string, Promise<unknown>>();
export function serializePreferenceIO<T>(key: string, action: () => Promise<T>): Promise<T> {
  const work = (queues.get(key) ?? Promise.resolve()).then(action);
  const settled = work.catch(() => undefined);
  queues.set(key, settled);
  void settled.then(() => { if (queues.get(key) === settled) queues.delete(key); });
  return work;
}
