import { useCallback, useEffect, useRef, useState } from 'react';
import { reconcileShares, type Notebook, type NotebookPlace } from '@live-to-eat/domain';
import { loadMyMap } from '@/features/maps/myMapApi';
import { listPrivateCollections } from '@/features/places/collectionsApi';
import { getOwnPublicMapEnabled } from '@/features/discover/publicMapApi';
import { createDemoNotebook, emptyNotebook } from './demoData';
import { readDemo, writeDemo } from './demoStorage';
import i18n from '@/lib/i18n';

export function useNotebook(isDemo: boolean) {
  const [state, setState] = useState<Notebook>(emptyNotebook);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [total, setTotal] = useState(0);
  const current = useRef(state);
  const revision = useRef(0);
  const queue = useRef<Promise<void> | null>(null);
  const refresh = useCallback(async () => {
    const run = ++revision.current;
    setLoading(true);
    setError(false);
    try {
      let next: Notebook;
      if (isDemo) {
        await queue.current;
        next = (await readDemo()) ?? createDemoNotebook();
      }
      else {
        const [map, collections, publicMapEnabled] = await Promise.all([
          loadMyMap(i18n.language.startsWith('ko') ? 'ko' : 'en'),
          listPrivateCollections(),
          getOwnPublicMapEnabled(),
        ]);
        next = {
          ...emptyNotebook(),
          places: map.places.map((p) => ({ ...p, publicNote: '' })),
          collections,
          profile: { ...emptyNotebook().profile, publicMapEnabled },
        };
        if (run === revision.current) setTotal(map.totalCount);
      }
      if (run !== revision.current) return;
      current.current = next;
      setState(next);
      if (isDemo) await i18n.changeLanguage(next.locale);
    } catch {
      if (run === revision.current) setError(true);
    } finally {
      if (run === revision.current) setLoading(false);
    }
  }, [isDemo]);
  const invalidate = useCallback(() => {
    revision.current++;
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    return invalidate;
  }, [refresh, invalidate]);
  const update = useCallback(
    (change: (value: Notebook) => Notebook) => {
      const next = change(current.current);
      current.current = next;
      setState(next);
      if (isDemo)
        queue.current = (queue.current ?? Promise.resolve())
          .catch(() => undefined)
          .then(() => writeDemo(next))
          .then(() => setStorageError(false))
          .catch(() => setStorageError(true));
    },
    [isDemo],
  );
  const upsert = useCallback(
    (place: NotebookPlace) =>
      update((book) => {
        const exists = book.places.some((p) => p.savedId === place.savedId);
        const places = exists
          ? book.places.map((p) => (p.savedId === place.savedId ? place : p))
          : [place, ...book.places];
        return { ...book, places, shares: reconcileShares(book.shares, places) };
      }),
    [update],
  );
  const remove = useCallback(
    (id: string) =>
      update((book) => {
        const places = book.places.filter((p) => p.savedId !== id);
        return { ...book, places, shares: reconcileShares(book.shares, places) };
      }),
    [update],
  );
  return {
    state,
    update,
    upsert,
    remove,
    loading,
    error,
    storageError,
    refresh,
    total: isDemo ? state.places.length : total,
  };
}
export type NotebookController = ReturnType<typeof useNotebook>;
