// Offline export only. Runtime/deploys use the checked-in, browser-ready GLBs.
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const sources = [
  ['casual-walker', 'ed578eebe688843f684391719158a08bf454665fd63f16df6b4745a57cffda9f'],
  ['dog-walker', 'a5408cf77434f9a74b112bc4924f07e1f86191edfac7f11eb4bb29b7d28b0ef4'],
  ['hiker', 'bbf5f07bf23991a967cd29ef6c692d852047f1fc0d6860f689108e8e485b2f6e'],
  ['road-worker', 'a7b66ac6b58404ad4d076b25dd77412191ef2462c6f5f06e72eb9cd854d4d17b'],
];
const basisURL = new URL('node_modules/three/examples/jsm/libs/basis/', root);
// Reuse Three's vendored Basis transcoder at export time. No extra runtime loader.
const source = await readFile(new URL('basis_transcoder.js', basisURL), 'utf8');
const require = createRequire(import.meta.url);
const BASIS = new Function('module', 'exports', 'require', '__dirname', source + '\nreturn BASIS;')
  ({ exports: {} }, {}, require, fileURLToPath(basisURL));
const basis = await BASIS({ wasmBinary: await readFile(new URL('basis_transcoder.wasm', basisURL)) });
basis.initializeBasis();
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
await mkdir(new URL('public/characters/', root), { recursive: true });

for (const [slug, sha256] of sources) {
  const response = await fetch(`https://tevy.dev/models/${slug}/v1/lod1.glb`);
  if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);
  const input = new Uint8Array(await response.arrayBuffer());
  if (createHash('sha256').update(input).digest('hex') !== sha256) throw new Error(`${slug}: source digest changed`);
  const doc = await io.readBinary(input);
  for (const texture of doc.getRoot().listTextures()) {
    const ktx = new basis.KTX2File(texture.getImage());
    try {
      if (!ktx.isValid() || !ktx.startTranscoding()) throw new Error('Invalid KTX2 image');
      const width = ktx.getWidth(), height = ktx.getHeight();
      const pixels = new Uint8Array(ktx.getImageTranscodedSizeInBytes(0, 0, 0, 13));
      if (!ktx.transcodeImage(pixels, 0, 0, 0, 13, 0, -1, -1)) throw new Error('KTX2 transcode failed');
      texture.setImage(await sharp(pixels, { raw: { width, height, channels: 4 } })
        .webp({ quality: 90, alphaQuality: 100 }).toBuffer()).setMimeType('image/webp');
    } finally { ktx.close(); ktx.delete(); }
  }
  doc.getRoot().listExtensionsUsed().find(extension => extension.extensionName === 'KHR_texture_basisu')?.dispose();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  // No waving at threatened dogs; keep small, useful locomotion/idle clips only.
  for (const animation of doc.getRoot().listAnimations()) {
    if (!['idle', 'walk', 'look_around'].includes(animation.getName())) animation.dispose();
  }
  await doc.transform(dedup(), resample({ tolerance: 0.0001 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const output = await io.writeBinary(doc);
  await writeFile(new URL(`public/characters/${slug}.glb`, root), output);
  console.log(`${slug}: ${input.byteLength} → ${output.byteLength} bytes`);
}
