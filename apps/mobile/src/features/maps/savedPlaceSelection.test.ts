import { describe, expect, it } from 'vitest';
import { inRegion, type NotebookPlace } from '@live-to-eat/domain';
import { demoCatalog } from '@/features/notebook/demoData';
import { indexSavedPlaces, selectSavedPlaces } from './savedPlaceSelection';

const places = (): NotebookPlace[] => Array.from({ length: 500 }, (_, index) => ({
  ...demoCatalog[index % demoCatalog.length]!, savedId: `qa-${index}`,
  displayName: `QA ${String(index).padStart(4, '0')} 한 끼`,
  note: `메모 ${index} ${'긴 기록 '.repeat(300)}`, tags: [`tag${index % 10}`, '커피'],
}));
const defaults = { mapRegion: 'all', status: 'all' as const, folder: 'all', sort: 'recent' as const, query: '' };

describe('indexed private list selection', () => {
  it('keeps all 500 records and returns the original record objects', () => {
    const records = places();
    const index = indexSavedPlaces(records, 'ko');
    const result = selectSavedPlaces(index, defaults);
    expect(result).toHaveLength(500);
    expect(result[499]).toBe(records[499]);
    expect(selectSavedPlaces(index, { ...defaults, query: ' QA 0499 ' })).toEqual([records[499]]);
  });

  it('matches combined region, visit, folder, note/tag search and ordering without changing source order', () => {
    const records = places().reverse();
    const originalIds = records.map((p) => p.savedId);
    const index = indexSavedPlaces(records, 'ko');
    for (const mapRegion of ['all', 'kr', 'seoul', 'busan', 'unclassified', 'unknown']) {
      for (const status of ['all', 'want', 'visited', 'recommended'] as const) {
        for (const folder of ['all', 'coffee', 'weekend']) {
          for (const query of ['', ' TAG1 ', '메모 49', '한 끼', 'missing']) {
            const result = selectSavedPlaces(index, { mapRegion, status, folder, query, sort: 'name' });
            const expected = records.filter((p) => inRegion(p, mapRegion) &&
              (status === 'all' || (status === 'recommended' && p.isRecommended) || p.visitStatus === status) &&
              (folder === 'all' || p.collectionId === folder) &&
              `${p.displayName} ${p.tags.join(' ')} ${p.note}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
              .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
            expect(result.map((p) => p.savedId)).toEqual(expected.map((p) => p.savedId));
          }
        }
      }
    }
    expect(records.map((p) => p.savedId)).toEqual(originalIds);
  });

  it('rebuilds search fields after an edit or deletion and keeps old indexes isolated', () => {
    const records = places();
    const previous = indexSavedPlaces(records, 'en');
    const edited = records.slice(1).map((p) => p.savedId === 'qa-499' ? Object.assign({}, p, { note: 'new search phrase' }) : p);
    const next = indexSavedPlaces(edited, 'en');
    expect(selectSavedPlaces(previous, { ...defaults, query: 'new search phrase' })).toEqual([]);
    expect(selectSavedPlaces(next, { ...defaults, query: 'new search phrase' })[0]?.savedId).toBe('qa-499');
    expect(selectSavedPlaces(next, defaults)).toHaveLength(499);
  });
});
