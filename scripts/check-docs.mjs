import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = [
  'AGENTS.md',
  'docs/01_PRODUCT.md',
  'docs/02_ARCHITECTURE.md',
  'docs/03_MAPS_AND_IMPORT.md',
  'docs/04_DEVELOPMENT.md',
  'docs/05_RELEASE.md',
];

const contents = await Promise.all(
  files.map(async (file) => [file, await readFile(path.join(root, file), 'utf8')]),
);
const combined = contents.map(([, content]) => content).join('\n');
const errors = [];

await Promise.all(
  contents.flatMap(([file, content]) =>
    [...content.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)#]+)(?:#[^)]+)?\)/g)].map(async (match) => {
      const target = path.resolve(root, path.dirname(file), match[1]);

      try {
        await access(target);
      } catch {
        errors.push(`${file}: missing relative link target ${match[1]}`);
      }
    }),
  ),
);

for (const [prefix, count] of [
  ['R', 20],
  ['B', 18],
  ['T', 16],
]) {
  for (let index = 1; index <= count; index += 1) {
    const id = `${prefix}${String(index).padStart(2, '0')}`;
    if (!combined.includes(id)) errors.push(`Missing documented ID ${id}`);
  }
}

const secretPatterns = [
  /sk_live_[A-Za-z0-9]{16,}/,
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /AIza[0-9A-Za-z_-]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

for (const pattern of secretPatterns) {
  if (pattern.test(combined)) errors.push(`Potential secret matched ${pattern}`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed (${files.length} files).`);
}
