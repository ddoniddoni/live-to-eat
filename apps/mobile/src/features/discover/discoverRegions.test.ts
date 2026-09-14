import { describe, expect, it } from 'vitest';
import { inRegion, notebookSchema } from '@live-to-eat/domain';
import { demoCatalog, demoPeople, createDemoNotebook } from '@/features/notebook/demoData';
import { publicPlacesInRegion } from './discoverRegions';

describe('domestic discovery without a service connection', () => {
  it('counts actual public places in a region, even when the author is based elsewhere', () => {
    const person = demoPeople.find((p) => p.handle === 'bada_busan')!;
    expect(publicPlacesInRegion(demoCatalog, person.ids, 'seogwipo').map((p) => p.savedId)).toEqual([
      'demo-jeju-rice',
    ]);
    expect(publicPlacesInRegion(demoCatalog, person.ids, 'busan')).toHaveLength(3);
    expect(publicPlacesInRegion(demoCatalog, person.ids, 'suyeong')).toHaveLength(2);
    expect(publicPlacesInRegion(demoCatalog, person.ids, 'seoul')).toEqual([]);
  });
  it('never includes places outside the author public selection', () => {
    expect(publicPlacesInRegion(demoCatalog, ['demo-table'], 'kr').map((p) => p.savedId)).toEqual([
      'demo-table',
    ]);
    expect(publicPlacesInRegion(demoCatalog, ['missing'], 'kr')).toEqual([]);
  });
  it('starts new notebooks with domestic examples and does not reuse old foreign IDs', () => {
    expect(demoCatalog.every((p) => inRegion(p, 'kr'))).toBe(true);
    expect(demoCatalog.some((p) => ['demo-noodle', 'demo-sushi'].includes(p.savedId))).toBe(false);
    expect(new Set(demoCatalog.map((p) => p.savedId)).size).toBe(demoCatalog.length);
    expect(createDemoNotebook().places).toHaveLength(6);
    expect(createDemoNotebook().places.every((p) => inRegion(p, 'kr'))).toBe(true);
  });
  it('accepts saved legacy records and shares unchanged', () => {
    const notebook = createDemoNotebook();
    const legacy = {
      ...notebook.places[0]!,
      savedId: 'demo-noodle',
      displayName: '멘야 하루',
      note: '내가 남긴 메모',
      visibility: 'unlisted' as const,
      regionPath: [
        { id: 'jp', label: '일본' },
        { id: 'tokyo', label: '도쿄' },
      ],
    };
    const stored = {
      ...notebook,
      places: [legacy],
      shares: [
        {
          id: 'legacy-share',
          title: '기록',
          regionId: 'tokyo',
          savedIds: [legacy.savedId],
          createdAt: 1,
          expiresAt: 2,
          revokedAt: null,
          showAuthor: false,
        },
      ],
    };
    expect(notebookSchema.parse(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
});
