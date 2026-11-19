# Human character assets

The four civilian characters in `/characters/` are from **tevy**, released by
the publisher under **CC0 1.0 Universal**. This dedication permits use,
modification and redistribution, including commercially. Attribution is not
required; the source is recorded here for provenance.

Primary source pages:

- Casual Walker: https://tevy.dev/models/casual-walker
- Dog Walker: https://tevy.dev/models/dog-walker
- Hiker: https://tevy.dev/models/hiker
- Road Worker: https://tevy.dev/models/road-worker
- CC0 legal terms: https://creativecommons.org/publicdomain/zero/1.0/legalcode
- Publisher's machine-readable asset catalogue: https://tevy.dev/models.json

Source downloads are the publisher's pinned **v1 LOD1** GLBs, retrieved on
2026-11-19 from `https://tevy.dev/models/{asset-name}/v1/lod1.glb`.
Each source GLB also embeds the notice `CC0 1.0, https://tevy.dev` in its glTF
asset copyright metadata.

| Asset | Original SHA-256 |
| --- | --- |
| casual-walker | ed578eebe688843f684391719158a08bf454665fd63f16df6b4745a57cffda9f |
| dog-walker | a5408cf77434f9a74b112bc4924f07e1f86191edfac7f11eb4bb29b7d28b0ef4 |
| hiker | bbf5f07bf23991a967cd29ef6c692d852047f1fc0d6860f689108e8e485b2f6e |
| road-worker | a7b66ac6b58404ad4d076b25dd77412191ef2462c6f5f06e72eb9cd854d4d17b |

Local modifications: embedded KTX2 textures were decoded to WebP; geometry and
animation tracks were compressed with Meshopt; the unused wave animation was
removed. The skins and idle, walk and look-around animations remain. Each model
has approximately 9,000 triangles and a 55-joint skeleton. The game adds its own
procedural kick animation over the skeleton. There is no sourced kick or run clip.

Recreate these checked-in exports using `node scripts/prepare-humans.mjs` after
installing the repository's development dependencies. That script verifies the
pinned source checksums before converting anything.

The CC0 dedication applies to these models and their included textures and
source animations. It does not change the license of Three.js, Meshoptimizer,
the application code or other assets in this repository. No Mixamo assets are
included in this character collection.
