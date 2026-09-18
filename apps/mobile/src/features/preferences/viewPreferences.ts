import type { Notebook } from '@live-to-eat/domain';

export type ViewPreferences = {
  mapRegion: string;
  discoverRegion: string;
  status: 'all' | 'want' | 'visited' | 'recommended';
  folder: string;
  mode: 'list' | 'map';
  sort: 'recent' | 'name';
};

export const defaultViewPreferences = (isDemo: boolean): ViewPreferences => ({
  mapRegion: 'all', discoverRegion: isDemo ? 'kr' : 'all',
  status: 'all', folder: 'all', mode: 'list', sort: 'recent',
});

const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 160 &&
  Array.from(value).every((character) => character.charCodeAt(0) >= 32);

// Only these six settings are stored: no search text, drafts, place details or credentials.
export function decodeViewPreferences(raw: string | null, isDemo: boolean): ViewPreferences {
  const defaults = defaultViewPreferences(isDemo);
  if (!raw) return defaults;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1) return defaults;
    const p = data as Record<string, unknown>;
    return {
      mapRegion: validId(p.mapRegion) ? p.mapRegion : defaults.mapRegion,
      discoverRegion: validId(p.discoverRegion) ? p.discoverRegion : defaults.discoverRegion,
      folder: validId(p.folder) ? p.folder : defaults.folder,
      status: p.status === 'want' || p.status === 'visited' || p.status === 'recommended' ? p.status : 'all',
      mode: p.mode === 'map' ? 'map' : 'list',
      sort: p.sort === 'name' ? 'name' : 'recent',
    };
  } catch { return defaults; }
}

export function encodeViewPreferences(value: ViewPreferences): string {
  const { mapRegion, discoverRegion, status, folder, mode, sort } = value;
  return JSON.stringify({ version: 1, mapRegion, discoverRegion, status, folder, mode, sort });
}

export function reconcileViewPreferences(value: ViewPreferences, context: {
  notebook: Notebook;
  completePlaces: boolean;
  discoverRegionIds: ReadonlySet<string>;
  isDemo: boolean;
}): ViewPreferences {
  const { notebook, completePlaces, discoverRegionIds, isDemo } = context;
  const hasRegion = value.mapRegion === 'all' || value.mapRegion === 'unclassified' ||
    notebook.places.some((place) => place.regionPath.some((part) => part.id === value.mapRegion));
  return {
    ...value,
    // Missing from a partial server page does not mean the region was deleted.
    mapRegion: !completePlaces || hasRegion ? value.mapRegion : 'all',
    folder: notebook.collections.some((folder) => folder.id === value.folder) ? value.folder : 'all',
    discoverRegion: isDemo && discoverRegionIds.has(value.discoverRegion) ? value.discoverRegion : isDemo ? 'kr' : 'all',
  };
}

export function preferenceStorageKey(scope: string): string {
  if (!/^(demo|account-[a-zA-Z0-9-]{1,80})$/.test(scope)) throw new Error('Invalid preference scope');
  return `livetoeat-view-v1-${scope}`;
}
