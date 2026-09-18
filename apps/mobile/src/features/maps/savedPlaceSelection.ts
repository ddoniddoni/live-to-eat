import { inRegion, type NotebookPlace } from '@live-to-eat/domain';
import type { ViewPreferences } from '@/features/preferences/viewPreferences';

type Entry = { place: NotebookPlace; text: string };
export type SavedPlaceIndex = { recent: Entry[]; name: Entry[] };

export function indexSavedPlaces(places: readonly NotebookPlace[], language: string): SavedPlaceIndex {
  const recent = places.map((place) => ({
    place,
    text: `${place.displayName} ${place.tags.join(' ')} ${place.note}`.toLocaleLowerCase(),
  }));
  // Sort a new index, preserving the original notebook order and record references.
  const name = [...recent].sort((a, b) => a.place.displayName.localeCompare(b.place.displayName, language));
  return { recent, name };
}

export function selectSavedPlaces(index: SavedPlaceIndex, options: Pick<ViewPreferences, 'mapRegion' | 'status' | 'folder' | 'sort'> & { query: string }): NotebookPlace[] {
  const query = options.query.trim().toLocaleLowerCase();
  const result: NotebookPlace[] = [];
  for (const entry of index[options.sort]) {
    const p = entry.place;
    if (inRegion(p, options.mapRegion) &&
      (options.status === 'all' || (options.status === 'recommended' && p.isRecommended) || p.visitStatus === options.status) &&
      (options.folder === 'all' || p.collectionId === options.folder) &&
      (!query || entry.text.includes(query))) result.push(p);
  }
  return result;
}
