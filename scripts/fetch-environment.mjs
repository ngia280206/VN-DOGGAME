import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Run from any directory with: node scripts/fetch-environment.mjs
// Source maps remain CC0; only resolution and delivery encoding change.
const output = fileURLToPath(new URL('../public/environment/', import.meta.url));
const licensePath = fileURLToPath(new URL('../public/licenses/ENVIRONMENT_ASSETS.md', import.meta.url));
const sourceSets = [
  { id: 'asphalt', asset: 'asphalt_floor' },
  { id: 'plaster', asset: 'worn_cracked_plaster' },
  { id: 'brick', asset: 'worn_brick_wall' },
  { id: 'metal', asset: 'rusty_corrugated_iron' },
];
const mapTypes = [
  { id: 'baseColor', key: 'Diffuse', suffix: 'basecolor', quality: 88 },
  { id: 'normal', key: 'nor_gl', suffix: 'normal', quality: 96 },
  { id: 'roughness', key: 'Rough', suffix: 'roughness', quality: 92 },
];

async function download(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === 3 || response.status < 500) throw new Error(`${response.status}: ${url}`);
  }
}

await mkdir(output, { recursive: true });
const assets = JSON.parse(await download('https://api.polyhaven.com/assets?t=textures'));
const materials = [];

for (const set of sourceSets) {
  const info = assets[set.asset];
  if (!info) throw new Error(`Poly Haven asset is missing: ${set.asset}`);
  const files = JSON.parse(await download(`https://api.polyhaven.com/files/${set.asset}`));
  const material = {
    id: set.id,
    name: info.name,
    repeatMeters: Number((info.dimensions[0] / 1000).toFixed(3)),
    resolution: 1024,
    normalConvention: 'OpenGL',
    colorSpace: { baseColor: 'sRGB', normal: 'linear', roughness: 'linear' },
    source: `https://polyhaven.com/a/${set.asset}`,
    author: Object.keys(info.authors).join(', '),
    license: 'CC0-1.0',
    sourceMaps: {},
  };

  for (const map of mapTypes) {
    const options = files[map.key]?.['1k'];
    const file = options?.png ?? options?.jpg;
    if (!file) throw new Error(`${set.asset}: ${map.key} has no 1K source`);
    const source = await download(file.url);
    if (file.md5 && createHash('md5').update(source).digest('hex') !== file.md5) {
      throw new Error(`Integrity mismatch: ${file.url}`);
    }
    const filename = `${set.id}.${map.suffix}.webp`;
    let pipeline = sharp(source).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).removeAlpha();
    if (map.id === 'roughness') pipeline = pipeline.greyscale();
    const encoded = await pipeline.webp({ quality: map.quality, effort: 6 }).toBuffer();
    await writeFile(`${output}${filename}`, encoded);
    material[map.id] = `/environment/${filename}`;
    material.sourceMaps[map.id] = {
      url: file.url,
      sourceMD5: createHash('md5').update(source).digest('hex'),
      bytes: encoded.length,
    };
    console.log(`${filename}: ${(encoded.length / 1024).toFixed(0)} KiB`);
  }
  materials.push(material);
}

await writeFile(`${output}materials.json`, `${JSON.stringify({ version: 1, materials }, null, 2)}\n`);
const credits = `# Environment texture sources

All texture sets below are original Poly Haven assets released under **CC0 1.0**.
The files in \`public/environment\` are 1024-pixel WebP derivatives of the original
1K diffuse, OpenGL tangent-space normal, and roughness maps. No generative image
processing was used. Source map URLs and integrity hashes are recorded in
\`public/environment/materials.json\`.

| Material | Asset | Artist | Physical tile width |
| --- | --- | --- | --- |
${materials.map(m => `| ${m.id} | [${m.name}](${m.source}) | ${m.author} | ${m.repeatMeters} m |`).join('\n')}

License: [Poly Haven asset license](https://polyhaven.com/license),
[CC0 1.0 legal deed](https://creativecommons.org/publicdomain/zero/1.0/).
Attribution is voluntary under CC0; these credits preserve provenance.

Recreate the optimized files with \`node scripts/fetch-environment.mjs\`.
Only base color uses sRGB; normal and roughness maps must use linear sampling.
\`repeatMeters\` is the source's physical tile width, so scale UV repetition by
surface size / \`repeatMeters\`. Metal is visibly rusted and should have low
metalness where oxidation covers the surface; no metalness map is included.
`;
await mkdir(fileURLToPath(new URL('../public/licenses/', import.meta.url)), { recursive: true });
await writeFile(licensePath, credits);
