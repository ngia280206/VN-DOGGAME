// Rebuild the playable model from the tracked, full-detail web export.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, simplify } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { GAITS, GESTURES } from '../web/game/animation.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const manifestPath = resolve(root, 'catalog.json');
const catalog = JSON.parse(await readFile(manifestPath, 'utf8'));
const dog = catalog.dogs.find(item => item.id === 'hmong_bobtail');
const source = resolve(root, 'models', 'hmong_bobtail.3e5d082c436416b5.glb');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
});
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const document = await io.read(source);
document.setLogger(new Logger(Logger.Verbosity.WARN));
const model = document.getRoot();
const clips = new Set([...GAITS, ...GESTURES]);
for (const animation of model.listAnimations()) {
  if (!clips.has(animation.getName())) animation.dispose();
}
for (const mesh of model.listMeshes()) {
  for (const part of mesh.listPrimitives()) {
    if (part.getMaterial()?.getName().endsWith('strand fur')) part.dispose();
  }
}
await document.transform(
  prune(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.42, error: 0.004 }),
  resample({ tolerance: 0.0001 }), dedup(), prune(),
);
for (const texture of model.listTextures()) {
  texture.setImage(await sharp(texture.getImage())
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 }).toBuffer());
}
await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const binary = await io.writeBinary(document);
const hash = createHash('sha256').update(binary).digest('hex').slice(0, 16);
const asset = `/models/${dog.id}-play.${hash}.glb`;
await writeFile(resolve(root, 'models', basename(asset)), binary);
await writeFile(manifestPath, JSON.stringify({
  version: 3, types: catalog.types.filter(type => type.id === dog.typeId),
  dogs: [{ ...dog, asset, bytes: binary.byteLength }],
}, null, 2) + '\n');
const triangles = model.listMeshes().flatMap(mesh => mesh.listPrimitives())
  .reduce((count, part) => count + part.getIndices().getCount() / 3, 0);
console.log(`${asset}: ${triangles.toLocaleString()} triangles, ${(binary.byteLength / 1e6).toFixed(2)} MB`);
