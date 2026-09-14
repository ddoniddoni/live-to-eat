import { describe, expect, it } from 'vitest';
import { buildRegionOptions, regionOptionsAt, searchCatalog } from './regions';
import { notebookPlaceSchema, inRegion, makeShareDraft, notebookSchema } from './notebook';

const part = (id: string, label = id) => ({ id, label });
const place = (id: string, regionPath: Array<{ id: string; label: string }>) =>
  notebookPlaceSchema.parse({
    savedId: id,
    displayName: '작은 커피',
    address: regionPath.map((p) => p.label).join(' '),
    regionPath,
    coordinate: null,
    collectionId: null,
    collectionName: null,
    isRecommended: false,
    note: 'private-secret',
    tags: ['카페'],
    version: 1,
    visitStatus: 'want',
    visibility: 'private',
  });
const seoul = place('s', [part('kr', '대한민국'), part('seoul', '서울'), part('seoul-central', '중구')]);
const busan = place('b', [
  part('kr', '대한민국'),
  part('busan', '부산'),
  part('busan-central', '중구'),
  part('local', '중앙동'),
]);
const old = place('old', [part('jp', '일본'), part('tokyo', '도쿄')]);
const unknown = place('u', []);
const places = [seoul, busan, old, unknown];

describe('region selection across notebook, search, discovery and sharing', () => {
  it('keeps variable depth and distinct IDs for places with the same region label', () => {
    const nodes = buildRegionOptions(places);
    expect(nodes.find((n) => n.id === 'kr')?.count).toBe(2);
    expect(regionOptionsAt(nodes, 'kr').map((n) => n.id)).toEqual(['seoul', 'busan']);
    expect(regionOptionsAt(nodes, 'seoul')[0]?.id).toBe('seoul-central');
    expect(regionOptionsAt(nodes, 'busan')[0]?.id).toBe('busan-central');
    expect(nodes.find((n) => n.id === 'local')?.path).toHaveLength(4);
  });
  it('searches full region paths inside the selected catalog root', () => {
    const nodes = buildRegionOptions(places);
    expect(regionOptionsAt(nodes, 'kr', '부산 중구', 'kr').map((n) => n.id)).toEqual([
      'busan-central',
      'local',
    ]);
    expect(regionOptionsAt(nodes, 'kr', '도쿄', 'kr')).toEqual([]);
    expect(regionOptionsAt(nodes, null, '중구').map((n) => n.id)).toEqual([
      'seoul-central',
      'busan-central',
      'local',
    ]);
  });
  it('includes descendants and keeps nationwide search separate from all saved records', () => {
    expect(searchCatalog(places, '커피', 'kr').map((p) => p.savedId)).toEqual(['s', 'b']);
    expect(searchCatalog(places, '부산 카페', 'seoul')).toEqual([]);
    expect(searchCatalog(places, '부산  카페', 'kr').map((p) => p.savedId)).toEqual(['b']);
    expect(searchCatalog(places, '커피', 'busan').map((p) => p.savedId)).toEqual(['b']);
    expect(searchCatalog(places, 'private-secret', 'kr')).toEqual([]);
  });
  it('preserves foreign and unclassified saves without relabeling or migrating them', () => {
    const before = JSON.stringify(places);
    buildRegionOptions(places);
    expect(places.filter((p) => inRegion(p, 'all'))).toHaveLength(4);
    expect(places.filter((p) => inRegion(p, 'unclassified'))).toEqual([unknown]);
    expect(places.filter((p) => inRegion(p, 'tokyo'))).toEqual([old]);
    expect(JSON.stringify(places)).toBe(before);
  });
  it('keeps region sharing inside the selected subtree and requires fresh consent', () => {
    const book = notebookSchema.parse({
      version: 1,
      places,
      collections: [],
      shares: [],
      blockedHandles: [],
      profile: { displayName: 'Test', bio: '', publicMapEnabled: false },
      locale: 'ko',
      welcomed: true,
    });
    const input = {
      id: 'share',
      title: '부산',
      regionId: 'busan',
      savedIds: ['b'],
      createdAt: 1,
      expiresAt: 2,
      showAuthor: false,
    };
    expect(() => makeShareDraft(book, input, false)).toThrow('CONSENT_REQUIRED');
    expect(makeShareDraft(book, input, true).shares[0]?.savedIds).toEqual(['b']);
    expect(() => makeShareDraft(book, { ...input, savedIds: ['s'] }, true)).toThrow('INVALID_SCOPE');
    expect(book.places[1]?.visibility).toBe('private');
  });
});
