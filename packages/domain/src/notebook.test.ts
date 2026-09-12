import { describe, expect, it } from 'vitest';
import {
  copyAsPrivate,
  exportCsv,
  exportRecords,
  makeShareDraft,
  notebookSchema,
  reconcileShares,
  removeCollection,
  visibleSharePlaces,
  type Notebook,
  type NotebookPlace,
} from './notebook';
const place: NotebookPlace = {
  savedId: 'a',
  displayName: 'Provider name',
  address: 'Provider address',
  coordinate: null,
  collectionId: 'f',
  collectionName: 'My folder',
  isRecommended: true,
  note: 'Secret',
  tags: ['personal'],
  regionPath: [
    { id: 'kr', label: 'Korea' },
    { id: 'seoul', label: 'Seoul' },
  ],
  version: 1,
  visitStatus: 'visited',
  visibility: 'private',
  publicNote: 'Public description',
};
const book = (): Notebook => ({
  version: 1,
  places: [place],
  collections: [{ id: 'f', name: 'My folder' }],
  shares: [],
  blockedHandles: [],
  profile: { displayName: 'Name', bio: '', publicMapEnabled: false },
  locale: 'ko',
  welcomed: true,
});
const input = {
  id: 's',
  title: 'Seoul',
  regionId: 'seoul',
  savedIds: ['a'],
  createdAt: 100,
  expiresAt: 200,
  showAuthor: true,
};
describe('notebook privacy and snapshot rules', () => {
  it('requires explicit consent before changing private records', () => {
    expect(() => makeShareDraft(book(), input, false)).toThrow('CONSENT_REQUIRED');
    expect(book().places[0]?.visibility).toBe('private');
  });
  it('rejects IDs and regions outside the reviewed selection', () => {
    expect(() => makeShareDraft(book(), { ...input, regionId: 'jp' }, true)).toThrow('INVALID_SCOPE');
    expect(() => makeShareDraft(book(), { ...input, savedIds: ['missing'] }, true)).toThrow('INVALID_SCOPE');
  });
  it('creates a fixed snapshot and promotes only selected private records', () => {
    const next = makeShareDraft({ ...book(), places: [place, { ...place, savedId: 'b' }] }, input, true);
    expect(next.places.map((p) => p.visibility)).toEqual(['unlisted', 'private']);
    expect(
      visibleSharePlaces(
        next.shares[0]!,
        [...next.places, { ...place, savedId: 'c', visibility: 'public' }],
        150,
      ).map((p) => p.savedId),
    ).toEqual(['a']);
  });
  it('expires and revokes immediately at the boundary', () => {
    const next = makeShareDraft(book(), input, true);
    expect(visibleSharePlaces(next.shares[0]!, next.places, 200)).toEqual([]);
    expect(visibleSharePlaces({ ...next.shares[0]!, revokedAt: 120 }, next.places, 150)).toEqual([]);
  });
  it('never resurrects a private or deleted item in an old snapshot', () => {
    const next = makeShareDraft(book(), input, true);
    const removed = reconcileShares(next.shares, [place]);
    expect(visibleSharePlaces(removed[0]!, [{ ...place, visibility: 'public' }], 150)).toEqual([]);
    expect(reconcileShares(next.shares, [])[0]?.savedIds).toEqual([]);
  });
  it('removes items moved outside the region permanently', () => {
    const next = makeShareDraft(book(), input, true);
    expect(
      reconcileShares(next.shares, [{ ...place, visibility: 'public', regionPath: [] }])[0]?.savedIds,
    ).toEqual([]);
  });
  it('does not copy private records, visit status, recommendation or public note', () => {
    const copied = copyAsPrivate(place, 'owned');
    expect(copied).toMatchObject({
      note: '',
      tags: [],
      publicNote: '',
      visitStatus: 'want',
      visibility: 'private',
      isRecommended: false,
      collectionId: null,
    });
  });
  it('preserves places when removing a folder', () => {
    const next = removeCollection(book(), 'f');
    expect(next.places).toHaveLength(1);
    expect(next.places[0]?.collectionId).toBeNull();
  });
  it('excludes provider content and optional private notes from export', () => {
    const data = JSON.stringify(exportRecords([place], false));
    expect(data).not.toContain('Provider');
    expect(data).not.toContain('Secret');
    expect(exportRecords([place], true)[0]?.personalNote).toBe('Secret');
  });
  it('escapes spreadsheet formulas, quotes and line breaks', () => {
    expect(exportCsv([{ ...place, note: '=HYPERLINK("x")\nnext' }], true)).toContain(
      '"\'=HYPERLINK(""x"")\nnext"',
    );
  });
  it('rejects malformed persisted state', () => {
    expect(notebookSchema.safeParse({ ...book(), version: 2 }).success).toBe(false);
  });
});
