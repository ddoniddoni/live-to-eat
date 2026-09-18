import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { buildRegionOptions } from '@live-to-eat/domain';
import { demoCatalog } from '@/features/notebook/demoData';
import type { NotebookController } from '@/features/notebook/useNotebook';
import { preferenceStorage } from './preferenceStorage';
import { reconcileViewPreferences } from './viewPreferences';
import { createViewPreferencesStore } from './viewPreferencesStore';

const demoRegionIds = new Set(buildRegionOptions(demoCatalog).map((region) => region.id));

// AppShell is keyed by scope, so changing accounts creates a fresh controller and notebook.
export function useViewPreferences(scope: string, isDemo: boolean, book: NotebookController) {
  const [store] = useState(() => createViewPreferencesStore(preferenceStorage(scope), isDemo));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.activate();
    void store.synchronize();
    return store.dispose;
  }, [store]);
  const value = useMemo(() => book.loaded && snapshot.ready ? reconcileViewPreferences(snapshot.value, {
    notebook: book.state, completePlaces: isDemo || book.total <= book.state.places.length,
    discoverRegionIds: demoRegionIds, isDemo,
  }) : snapshot.value, [book.loaded, book.state, book.total, isDemo, snapshot.ready, snapshot.value]);
  useEffect(() => {
    if (book.loaded && snapshot.ready) void store.update(value);
  }, [book.loaded, snapshot.ready, store, value]);
  return { ...snapshot, value, update: store.update, retry: store.synchronize };
}
