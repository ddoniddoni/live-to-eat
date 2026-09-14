import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { reconcileShares, type NotebookPlace } from '@live-to-eat/domain';
import { loadMyMap } from '@/features/maps/myMapApi';
import { listPrivateCollections } from '@/features/places/collectionsApi';
import { getOwnPublicMapEnabled } from '@/features/discover/publicMapApi';
import { createDemoNotebook, emptyNotebook } from './demoData';
import { readDemo, writeDemo } from './demoStorage';
import { createNotebookStore } from './notebookStore';
import { beforeDemoOperation } from './demoRequests';
import { RequestFailure } from '@/lib/requests/request';
import i18n from '@/lib/i18n';

export function useNotebook(isDemo: boolean) {
  const [store] = useState(() => createNotebookStore({
    initial: emptyNotebook(),
    read: async (signal) => {
      if (isDemo) {
        await beforeDemoOperation('load', signal);
        const state = (await readDemo()) ?? createDemoNotebook();
        return { state, total: state.places.length };
      }
      const [map, collections, publicMapEnabled] = await Promise.all([
        loadMyMap(i18n.language.startsWith('ko') ? 'ko' : 'en'),
        listPrivateCollections(), getOwnPublicMapEnabled(),
      ]);
      return {
        state: { ...emptyNotebook(), places: map.places.map((p) => ({ ...p, publicNote: '' })),
          collections, profile: { ...emptyNotebook().profile, publicMapEnabled } },
        total: map.totalCount,
      };
    },
    write: async (next, operation) => {
      if (!isDemo) return;
      await beforeDemoOperation(operation);
      try { await writeDemo(next); } catch { throw new RequestFailure('storage'); }
    },
  }));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.activate();
    void store.refresh();
    return store.dispose;
  }, [store]);
  useEffect(() => {
    if (isDemo && snapshot.loaded) void i18n.changeLanguage(snapshot.state.locale);
  }, [isDemo, snapshot.loaded, snapshot.state.locale]);
  const upsert = useCallback((place: NotebookPlace) => store.update((book) => {
    const exists = book.places.some((p) => p.savedId === place.savedId);
    const places = exists ? book.places.map((p) => p.savedId === place.savedId ? place : p) : [place, ...book.places];
    return { ...book, places, shares: reconcileShares(book.shares, places) };
  }), [store]);
  const remove = useCallback((id: string) => store.update((book) => {
    const places = book.places.filter((p) => p.savedId !== id);
    return { ...book, places, shares: reconcileShares(book.shares, places) };
  }), [store]);
  return { ...snapshot, update: store.update, upsert, remove, refresh: store.refresh,
    total: isDemo ? snapshot.state.places.length : snapshot.total };
}
export type NotebookController = ReturnType<typeof useNotebook>;
