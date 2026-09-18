import { inRegion, type NotebookPlace } from '@live-to-eat/domain';

export function countPublicPlacesByPerson<T extends { ids: readonly string[] }>(
  catalog: readonly NotebookPlace[], people: readonly T[], region: string,
): Array<T & { publicPlaceCount: number }> {
  const regionIds = new Set(catalog.filter((place) => inRegion(place, region)).map((place) => place.savedId));
  return people.map((person) => ({ ...person,
    publicPlaceCount: [...new Set(person.ids)].filter((id) => regionIds.has(id)).length,
  }));
}

export function publicPlacesInRegion(
  catalog: readonly NotebookPlace[],
  publicIds: readonly string[],
  region: string,
): NotebookPlace[] {
  const allowed = new Set(publicIds);
  return catalog.filter((place) => allowed.has(place.savedId) && inRegion(place, region));
}
