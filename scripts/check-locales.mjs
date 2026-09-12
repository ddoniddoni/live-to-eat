import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const flatten = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, item]) =>
    typeof item === 'string' ? [[prefix + key, item]] : flatten(item, prefix + key + '.'),
  );
const [ko, en] = await Promise.all(
  ['ko', 'en'].map(
    async (lang) => new Map(flatten(JSON.parse(await readFile(`apps/mobile/locales/${lang}.json`, 'utf8')))),
  ),
);
let failures = 0;
for (const key of new Set([...ko.keys(), ...en.keys()])) {
  if (!ko.has(key) || !en.has(key)) {
    console.error(`Missing translation: ${key}`);
    failures++;
    continue;
  }
  const vars = (text) =>
    [...text.matchAll(/{{\s*(\w+)\s*}}/g)]
      .map((m) => m[1])
      .sort()
      .join(',');
  if (vars(ko.get(key)) !== vars(en.get(key))) {
    console.error(`Placeholder mismatch: ${key}`);
    failures++;
  }
}
async function scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) return scan(file);
      if (!/\.tsx?$/.test(file)) return;
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(/\bt\(['"]([\w.]+)['"]/g)) {
        if (!ko.has(match[1])) {
          console.error(`Unknown translation: ${match[1]} (${file})`);
          failures++;
        }
      }
    }),
  );
}
await scan('apps/mobile/src');
if (failures) process.exitCode = 1;
else
  console.log(
    `Locale check passed (${ko.size} Korean/English keys, matching placeholders and static references).`,
  );
