# Environment texture sources

All texture sets below are original Poly Haven assets released under **CC0 1.0**.
The files in `public/environment` are 1024-pixel WebP derivatives of the original
1K diffuse, OpenGL tangent-space normal, and roughness maps. No generative image
processing was used. Source map URLs and integrity hashes are recorded in
`public/environment/materials.json`.

| Material | Asset | Artist | Physical tile width |
| --- | --- | --- | --- |
| asphalt | [Asphalt Floor](https://polyhaven.com/a/asphalt_floor) | eye-candy.xyz | 2.35 m |
| plaster | [Worn Cracked Plaster](https://polyhaven.com/a/worn_cracked_plaster) | Amal Kumar | 1.8 m |
| brick | [Worn Brick Wall](https://polyhaven.com/a/worn_brick_wall) | Amal Kumar | 2 m |
| metal | [Rusty Corrugated Iron](https://polyhaven.com/a/rusty_corrugated_iron) | Charlotte Baglioni | 2 m |

License: [Poly Haven asset license](https://polyhaven.com/license),
[CC0 1.0 legal deed](https://creativecommons.org/publicdomain/zero/1.0/).
Attribution is voluntary under CC0; these credits preserve provenance.

Recreate the optimized files with `node scripts/fetch-environment.mjs`.
Only base color uses sRGB; normal and roughness maps must use linear sampling.
`repeatMeters` is the source's physical tile width, so scale UV repetition by
surface size / `repeatMeters`. Metal is visibly rusted and should have low
metalness where oxidation covers the surface; no metalness map is included.
