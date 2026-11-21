// Run only when exporting local authoring assets. Deployments use the tracked exports.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat, copyFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { PLAYABLE_IDS } from '../web/roster.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'public/models');
const settings = 'web-v1-meshopt-medium-texture1024-quality90';
const limitFlag = process.argv.indexOf('--limit');
const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1]);
if (!(limit > 0)) throw new Error('--limit must be a positive integer');

const base = JSON.parse(await readFile(resolve(root, 'dog_catalog.json'), 'utf8'));
const custom = JSON.parse(await readFile(resolve(root, 'custom_catalog.json'), 'utf8'));
const dogs = PLAYABLE_IDS.map(id => base.dogs.find(dog => dog.id === id)).slice(0, limit);
if (dogs.some(dog => !dog)) throw new Error('A playable dog is missing from the original catalog');
const customIds = new Set(custom.dogs.map(dog => dog.id));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
await mkdir(output, { recursive: true });
const imageCache = new Map();
const exported = [];
let originalBytes = 0;
let webBytes = 0;

for (const [index, dog] of dogs.entries()) {
  const source = resolve(root, dog.asset);
  const input = await readFile(source);
  const fingerprint = createHash('sha256').update(settings).update(input).digest('hex').slice(0, 16);
  const filename = `${dog.id}.${fingerprint}.glb`;
  const destination = resolve(output, filename);
  let exists = true;
  try { await stat(destination); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    exists = false;
  }
  if (!exists) {
    const document = await io.readBinary(new Uint8Array(input));
    document.setLogger(new Logger(Logger.Verbosity.WARN));
    for (const texture of document.getRoot().listTextures()) {
      const image = texture.getImage();
      if (!image) continue;
      const key = createHash('sha256').update(image).digest('hex');
      if (!imageCache.has(key)) {
        imageCache.set(key, await sharp(image)
          .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90, alphaQuality: 100 }).toBuffer());
      }
      texture.setImage(imageCache.get(key)).setMimeType('image/webp');
    }
    document.createExtension(EXTTextureWebP).setRequired(true);
    await document.transform(dedup(), resample({ tolerance: 0.00001 }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(destination, document);
  }
  const size = (await stat(destination)).size;
  originalBytes += input.length;
  webBytes += size;
  exported.push({
    id: dog.id, name: dog.name, typeId: dog.type_id, typeName: dog.type_name,
    variantId: dog.variant_id, variantLabel: dog.variant_label,
    ageStage: dog.age_stage || 'adult', height: dog.height,
    custom: customIds.has(dog.id), asset: `/models/${filename}`, bytes: size,
  });
  console.log(`[${index + 1}/${dogs.length}] ${dog.id}: ${(input.length / 1e6).toFixed(1)} → ${(size / 1e6).toFixed(2)} MB`);
}

if (Number.isFinite(limit)) {
  console.log('Sample only; catalog.json was not replaced.');
} else {
  await writeFile(resolve(root, 'public/catalog.json'), JSON.stringify({
    version: 2, types: base.types.filter(type => PLAYABLE_IDS.includes(type.id)), dogs: exported,
    export: { settings, originalBytes, webBytes },
  }) + '\n');
  await mkdir(resolve(root, 'public/licenses'), { recursive: true });
  for (const name of ['PUG_LICENSE.txt', 'GOBKIT_LICENSE.txt']) {
    await copyFile(resolve(root, 'assets', name), resolve(root, 'public/licenses', basename(name)));
  }
  const sourceNotice = await readFile(resolve(root, 'Textures/README.txt'), 'utf8');
  const notice = sourceNotice.replaceAll('\r\n', '\n').split('\nLICENSE\n')[1];
  if (!notice) throw new Error('The original model source license notice is missing');
  await writeFile(resolve(root, 'public/licenses/LABRADOR_SOURCE.txt'),
    'LABRADOR - Rigged & Animated Game Asset\n\nLICENSE\n' + notice);
}
console.log(`Total: ${(originalBytes / 1e6).toFixed(1)} → ${(webBytes / 1e6).toFixed(1)} MB`);
