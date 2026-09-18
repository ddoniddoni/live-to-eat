// Node 24+. Writes synthetic QA artifacts only; never installs them into an app.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDemoNotebook, demoCatalog, demoPeople } from '../apps/mobile/src/features/notebook/demoData.ts';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/mobile-performance-fixtures.mjs <output-directory>');
const directory = resolve(output);
const makePlaces = (prefix) => Array.from({ length: 500 }, (_, index) => {
  const base = demoCatalog[index % demoCatalog.length];
  const number = String(index).padStart(4, '0');
  return { ...base, savedId: `${prefix}-${number}`, displayName: `QA Place ${number}`,
    address: `${base.address} · QA ${number}`, note: `PRIVATE-NOTE-${number} ${'테스트 메모 '.repeat(190)}`,
    tags: [`tag${index % 10}`, 'QA'], visibility: 'private',
    visitStatus: index % 2 ? 'visited' : 'want', isRecommended: index % 4 === 1 };
});
const notebook = { ...createDemoNotebook(), places: makePlaces('perf-owned'), welcomed: true };
const catalog = makePlaces('perf-public');
const people = Array.from({ length: 500 }, (_, index) => ({
  ...demoPeople[index % demoPeople.length], handle: `qa_person_${String(index).padStart(4, '0')}`,
  displayName: `QA Person ${String(index).padStart(4, '0')}`, bio: `QA public map ${index}`,
  ids: index === 0 ? catalog.map((place) => place.savedId) : [catalog[index].savedId],
}));
await mkdir(directory, { recursive: true });
await Promise.all([
  writeFile(resolve(directory, 'notebook.json'), JSON.stringify(notebook)),
  writeFile(resolve(directory, 'discovery.json'), JSON.stringify({ catalog, people })),
]);
console.log('Created 500 private places, 500 public candidates and 500 synthetic people in', directory);
