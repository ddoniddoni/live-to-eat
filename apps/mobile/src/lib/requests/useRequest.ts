import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRequest } from './request';

export function useRequest<T = void>(options?: { latest?: boolean; timeoutMs?: number }) {
  const [request] = useState(() => createRequest<T>(options));
  const state = useSyncExternalStore(request.subscribe, request.getSnapshot, request.getSnapshot);
  useEffect(() => request.cancel, [request]);
  return { ...state, run: request.run, cancel: request.cancel };
}
