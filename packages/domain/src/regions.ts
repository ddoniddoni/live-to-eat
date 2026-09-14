import { inRegion, type NotebookPlace } from './notebook';

export type RegionPart = Readonly<{ id: string; label: string }>;
export type RegionSource = Readonly<{ regionPath: readonly RegionPart[] }>;
export type RegionOption = Readonly<{
  id: string;
  label: string;
  parentId: string | null;
  path: readonly RegionPart[];
  count: number;
}>;

// Region IDs belong to the source catalog. Never join regions by their labels
// or rewrite stored paths to force a fixed country/province/district depth.
export function buildRegionOptions(places: readonly RegionSource[]): RegionOption[] {
  const options = new Map<string, RegionOption>();
  for (const place of places) {
    const seen = new Set<string>();
    for (const [index, part] of place.regionPath.entries()) {
      if (seen.has(part.id)) continue;
      seen.add(part.id);
      const current = options.get(part.id);
      options.set(
        part.id,
        current
          ? { ...current, count: current.count + 1 }
          : {
              ...part,
              parentId: place.regionPath[index - 1]?.id ?? null,
              path: place.regionPath.slice(0, index + 1),
              count: 1,
            },
      );
    }
  }
  return [...options.values()];
}

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim();
export function matchesSearch(text: string, query: string): boolean {
  const normalized = normalize(text).replace(/\s+/g, ' ');
  return normalize(query)
    .split(/\s+/)
    .every((word) => normalized.includes(word));
}

export function regionOptionsAt(
  options: readonly RegionOption[],
  parentId: string | null,
  query = '',
  rootId: string | null = null,
): RegionOption[] {
  return options.filter((option) => {
    if (rootId && (!option.path.some((part) => part.id === rootId) || option.id === rootId)) return false;
    return query.trim()
      ? matchesSearch(option.path.map((part) => part.label).join(' '), query)
      : option.parentId === parentId;
  });
}

export function searchCatalog(
  places: readonly NotebookPlace[],
  query: string,
  regionId: string,
): NotebookPlace[] {
  return places.filter(
    (place) =>
      inRegion(place, regionId) &&
      matchesSearch(
        [place.displayName, place.address, ...place.regionPath.map((part) => part.label), ...place.tags].join(
          ' ',
        ),
        query,
      ),
  );
}
