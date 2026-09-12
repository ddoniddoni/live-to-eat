import type { NotebookPlace } from '@live-to-eat/domain';
export const artKind = (place: NotebookPlace): number =>
  place.tags.some((t) => /커피|카페|coffee/i.test(t))
    ? 1
    : place.tags.some((t) => /베이커리|빵|bakery/i.test(t))
      ? 2
      : place.tags.some((t) => /라멘|스시|ramen/i.test(t))
        ? 3
        : 0;
