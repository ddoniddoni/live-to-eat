// Bundle with the repository's Rolldown CLI, then run with Node (see docs/04_DEVELOPMENT.md).
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { inRegion, type NotebookPlace } from '@live-to-eat/domain';
import { indexSavedPlaces, selectSavedPlaces } from '../apps/mobile/src/features/maps/savedPlaceSelection';
import { countPublicPlacesByPerson, publicPlacesInRegion } from '../apps/mobile/src/features/discover/discoverRegions';

const directory = process.argv[2];
if (!directory) throw new Error('Pass the synthetic fixture directory');
const records: NotebookPlace[] = JSON.parse(readFileSync(`${directory}/notebook.json`, 'utf8')).places;
const { catalog, people }: { catalog: NotebookPlace[]; people: Array<{ ids: string[] }> } =
  JSON.parse(readFileSync(`${directory}/discovery.json`, 'utf8'));
const queries = ['', 'QA', '0049', 'tag1', 'PRIVATE-NOTE-0499', '없는 장소'];
const started = performance.now();
const index = indexSavedPlaces(records, 'ko');
const indexBuildMs = performance.now() - started;
// The previous implementation, kept here only as a benchmark reference.
const reference = (query: string, region: string) => records.filter((p) => inRegion(p, region) &&
  `${p.displayName} ${p.tags.join(' ')} ${p.note}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
const optimized = (query: string, region: string) => selectSavedPlaces(index, {
  mapRegion: region, status: 'all', folder: 'all', sort: 'name', query,
});
function measure(action: (iteration: number) => unknown) {
  for (let i = 0; i < 60; i++) action(i);
  const samples = Array.from({ length: 600 }, (_, i) => {
    const start = performance.now();
    action(i);
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return { p50Ms: samples[300], p95Ms: samples[570] };
}
for (const query of queries) {
  for (const region of ['all', 'seoul', 'busan']) assert.deepEqual(optimized(query, region), reference(query, region));
}
assert.deepEqual(countPublicPlacesByPerson(catalog, people, 'seoul').map((p) => p.publicPlaceCount),
  people.map((p) => publicPlacesInRegion(catalog, p.ids, 'seoul').length));
console.log(JSON.stringify({ runtime: process.version, records: records.length, people: people.length,
  noteCharacters: records[0]?.note.length, samples: 600, indexBuildMs,
  privateSearchBefore: measure((i) => reference(queries[i % queries.length]!, i % 2 ? 'all' : 'seoul')),
  privateSearchAfter: measure((i) => optimized(queries[i % queries.length]!, i % 2 ? 'all' : 'seoul')),
  publicCountBefore: measure(() => people.map((p) => publicPlacesInRegion(catalog, p.ids, 'seoul').length)),
  publicCountAfter: measure(() => countPublicPlacesByPerson(catalog, people, 'seoul')),
}, null, 2));
