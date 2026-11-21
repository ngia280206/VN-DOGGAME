import { mkdir, cp, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'vendor'), { recursive: true });
await cp(resolve(root, 'web'), dist, { recursive: true });
await cp(resolve(root, 'public'), dist, { recursive: true });
for (const filename of ['three.module.js', 'three.core.js']) {
  await copyFile(resolve(root, 'node_modules/three/build', filename), resolve(dist, 'vendor', filename));
}
for (const filename of ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js']) {
  const destination = resolve(dist, 'vendor/addons', filename);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await copyFile(resolve(root, 'node_modules/three/examples/jsm', filename), destination);
}
await copyFile(resolve(root, 'node_modules/meshoptimizer/meshopt_decoder.mjs'),
  resolve(dist, 'vendor/meshopt_decoder.mjs'));
await mkdir(resolve(dist, 'licenses'), { recursive: true });
const packages = ['three', 'meshoptimizer'];
const notices = [];
for (const name of packages) {
  const directory = resolve(root, 'node_modules', name);
  const metadata = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  notices.push(`${metadata.name} ${metadata.version} — ${metadata.license}\n${metadata.homepage || ''}`);
  for (const filename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
    try {
      await copyFile(resolve(directory, filename), resolve(dist, 'licenses', `${name.replaceAll('/', '-')}-${filename}`));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
await writeFile(resolve(dist, 'licenses/DEPENDENCIES.txt'), notices.join('\n\n') + '\n');
await writeFile(resolve(dist, 'licenses/index.html'), `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Credits &amp; licenses — Pawtown</title>
<body style="max-width:720px;margin:60px auto;padding:24px;font:16px/1.7 system-ui;color:#294d3b">
<a href="/">← Back to Pawtown</a><h1>Credits &amp; licenses</h1>
<ul><li><a href="LABRADOR_SOURCE.txt">Labrador source model usage notice</a></li>
<li><a href="PUG_LICENSE.txt">Quaternius source notice</a></li>
<li><a href="GOBKIT_LICENSE.txt">Gobkit source notice</a></li>
<li><a href="DEPENDENCIES.txt">Game engine and decoder dependencies</a></li></ul>
<p>Models are included for use in this application. Source-model redistribution restrictions still apply.</p></body></html>`);
await writeFile(resolve(dist, 'healthz'), 'ok\n');
console.log('Built dist/: Pawtown game, 10 playable dogs, Three.js and local decoder.');
