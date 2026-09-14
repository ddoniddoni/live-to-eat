import { RequestFailure } from '@/lib/requests/request';

export type DemoOperation = 'load' | 'search' | 'save' | 'share' | 'settings';

// Explicit development-only injection; each failure is consumed once.
// No device connectivity, account, or server settings are changed.
export function createDemoFailures(plan: string, enabled: boolean) {
  const remaining = enabled ? plan.split(',') : [];
  return async (operation: DemoOperation, signal?: AbortSignal) => {
    const index = remaining.findIndex((item) => item.startsWith(`${operation}:`));
    if (index < 0) return;
    const kind = remaining.splice(index, 1)[0]?.split(':')[1];
    if (signal?.aborted) return;
    if (kind === 'slow') {
      await new Promise<void>((resolve) => {
        const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, 2500);
        signal?.addEventListener('abort', done, { once: true });
      });
    } else if (kind === 'offline' || kind === 'timeout' || kind === 'storage') {
      throw new RequestFailure(kind);
    }
  };
}

export const beforeDemoOperation = createDemoFailures(
  process.env.EXPO_PUBLIC_DEMO_FAILURE_PLAN ?? '',
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_AUTH_PREVIEW === 'true',
);
