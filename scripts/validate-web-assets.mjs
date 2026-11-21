import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYABLE_IDS } from '../web/roster.mjs';

const publicRoot = process.argv[2] ? resolve(process.argv[2])
  : fileURLToPath(new URL('../public/', import.meta.url));
const catalog = JSON.parse(await readFile(resolve(publicRoot, 'catalog.json'), 'utf8'));
if (!catalog.dogs.length || !catalog.types.length) throw new Error('The web catalog is empty');
if (catalog.dogs.length !== PLAYABLE_IDS.length || !PLAYABLE_IDS.every(id => catalog.dogs.some(dog => dog.id === id))) {
  throw new Error('The game catalog must contain exactly the 10 playable dogs');
}
const ids = new Set();
let total = 0;
for (const dog of catalog.dogs) {
  if (ids.has(dog.id)) throw new Error(`Duplicate model ID: ${dog.id}`);
  ids.add(dog.id);
  if (!/^\/models\/[a-z0-9_.-]+\.[a-f0-9]{16}\.glb$/.test(dog.asset)) {
    throw new Error(`Invalid model URL: ${dog.asset}`);
  }
  const path = resolve(publicRoot, '.' + dog.asset);
  if (!path.startsWith(publicRoot.endsWith(sep) ? publicRoot : publicRoot + sep)) {
    throw new Error(`Model escapes public directory: ${dog.id}`);
  }
  const info = await stat(path);
  if (info.size !== dog.bytes || !info.size) throw new Error(`Wrong model size: ${dog.id}`);
  if (info.size >= 100 * 1024 * 1024) throw new Error(`Model exceeds GitHub's file limit: ${dog.id}`);
  total += info.size;
}
console.log(`Web assets: ${ids.size} models, ${(total / 1e6).toFixed(1)} MB; all files present.`);
