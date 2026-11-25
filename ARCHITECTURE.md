# Pawtown architecture

Pawtown ships one rigged H’Mông cộc and an open circular stage. The ground and sky
are two procedural meshes. The ground shader draws the grid, boundary, and a
contact shadow in the same pass. Both meshes use local shaders and need no
environment textures or shadow maps.

`engine.mjs` runs movement in fixed 60 Hz steps, interpolates the rendered
position, and applies mouse or touch camera input per rendered frame. The
first-person camera follows the dog's eye height. Third-person play and the
opening preview show the skinned dog. First-person play skips skin animation
and drawing. The preview draws at up to 30 Hz. Pausing draws only when the
viewport changes. Rendering caps pixel density and total buffer size, with a
smaller budget on touch devices.

`animation.mjs` blends Idle, Walk, Trot, and Gallop at a shared, distance-driven
phase. Bark uses a one-shot clip and the dog tilts with its jump velocity. `npm run models:prepare` derives the
playable GLB from the tracked H’Mông cộc source export. It keeps the rig and
gameplay clips, removes the high-poly strand mesh, simplifies the remaining
meshes, resizes textures, and writes a content-fingerprinted Meshopt export.

`npm run build` validates the playable catalog and ships only its model, local
Three.js and the Meshopt decoder. The static build runs with the Node server
or Docker. The desktop tools use their own catalogs and models.
