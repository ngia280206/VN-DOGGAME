// Decode the complete shipped library using the same decoder as the viewer.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const catalog = JSON.parse(await readFile(resolve(root, 'catalog.json'), 'utf8'));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  .setLogger(new Logger(Logger.Verbosity.ERROR));
for (const [index, dog] of catalog.dogs.entries()) {
  const document = await io.read(resolve(root, '.' + dog.asset));
  const model = document.getRoot();
  assert.equal(model.listSkins()[0].listJoints().length, 80, dog.id);
  const clips = new Set(model.listAnimations().map(clip => clip.getName()));
  for (const clip of ['Idle', 'Walk', 'Trot', 'Gallop']) assert.ok(clips.has(clip), `${dog.id}: ${clip}`);
  for (const mesh of model.listMeshes()) {
    for (const part of mesh.listPrimitives()) {
      for (const semantic of ['POSITION', 'NORMAL', 'WEIGHTS_0']) {
        const attribute = part.getAttribute(semantic);
        assert.ok(attribute, `${dog.id}: ${semantic}`);
        assert.ok(attribute.getArray().every(Number.isFinite), `${dog.id}: ${semantic}`);
      }
    }
  }
  if ((index + 1) % 50 === 0) console.log(`Decoded and checked ${index + 1}/${catalog.dogs.length} models`);
}
console.log(`PASS: ${catalog.dogs.length} compressed models decode with the browser's decoder; rigs, clips and mesh data intact.`);
