import { inRegion, type NotebookPlace } from '@live-to-eat/domain';

export function publicPlacesInRegion(
  catalog: readonly NotebookPlace[],
  publicIds: readonly string[],
  region: string,
): NotebookPlace[] {
  const allowed = new Set(publicIds);
  return catalog.filter((place) => allowed.has(place.savedId) && inRegion(place, region));
}
