// Decode and check the playable model using the same decoder as the browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { GAITS, GESTURES } from '../web/game/animation.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const catalog = JSON.parse(await readFile(resolve(root, 'catalog.json'), 'utf8'));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  .setLogger(new Logger(Logger.Verbosity.ERROR));
for (const dog of catalog.dogs) {
  const document = await io.read(resolve(root, '.' + dog.asset));
  const model = document.getRoot();
  assert.equal(model.listSkins()[0].listJoints().length, 80, dog.id);
  const clips = new Set(model.listAnimations().map(clip => clip.getName()));
  assert.deepEqual(clips, new Set([...GAITS, ...GESTURES]));
  let triangles = 0;
  for (const mesh of model.listMeshes()) {
    for (const part of mesh.listPrimitives()) {
      triangles += part.getIndices().getCount() / 3;
      for (const semantic of ['POSITION', 'NORMAL', 'WEIGHTS_0']) {
        const attribute = part.getAttribute(semantic);
        assert.ok(attribute, `${dog.id}: ${semantic}`);
        assert.ok(attribute.getArray().every(Number.isFinite), `${dog.id}: ${semantic}`);
      }
    }
  }
  assert.ok(triangles > 0 && triangles < 35000, `Playable mesh has ${triangles} triangles`);
  console.log(`PASS: ${dog.id} decoded with ${triangles.toLocaleString()} triangles, ${clips.size} clips and intact skin data.`);
}
