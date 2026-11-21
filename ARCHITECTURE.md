# Pawtown architecture

## Playable world

The browser boots a real Three.js scene covering the viewport. A ten-character
selection overlay previews the selected dog in the village. Starting play hands
control to that same animated dog. The interface becomes an in-game HUD rather
than a model catalog.

`web/game/engine.mjs` owns the renderer, fixed scene lifetime, player state,
keyboard/pointer input, follow camera and animation blending. It coordinates the
static world, resident simulation and model cache through separate modules.
`choose`, `playing` and `paused` modes explicitly control movement, simulation and
UI. Pausing freezes residents, animation and simulation time. Blur and background
tabs pause active play to prevent stuck movement keys.

## Movement and interaction

`physics.mjs` provides camera-relative normalized input, analytic acceleration,
shortest-angle steering and collision substeps with sliding. It also handles
bounded sprint energy and nearest-resident targeting. Jumping uses a vertical
velocity with gravity. Body/age source geometry does not change at runtime.

Eight procedural human NPCs follow authored paths with idle pauses, walking limbs
and name labels. Greeting a nearby NPC turns them toward the player and triggers
a wave and dialogue. Unique greetings advance a three-friend objective. Barking
gets a nearby resident's attention. Floating treats can be collected by walking
into them. These are local NPC interactions, not simulated online player activity.

The prototype is single-player and database-free. Real multiplayer would need a
separate session/network service; no fake online users or network chat are shown.

## World and rendering

`world.mjs` authors a village with houses, shops, footpaths, a fountain, lake,
benches, planters, trees, clouds and a play lawn. Instanced foliage limits draw
calls. A directional shadow map follows the player; contact shadows anchor NPCs.
The HUD minimap uses the same landmarks, resident positions and player heading.

## Assets

`roster.mjs` is the source of truth for the ten playable IDs. The deployed catalog
and model validator enforce that exact roster. Only those ten compressed GLBs
are included in `public/` and `dist/` (about 34 MB of models).

`assets.mjs` loads Meshopt GLBs, clones skin hierarchies with SkeletonUtils,
normalizes their physical scale, and creates an AnimationMixer per dog. References
protect geometry/materials shared by clones. Idle cache entries are evicted once
more than three model entries are retained; current and ambient dogs stay alive.
Selection generation tokens prevent a slower previous load replacing the latest
choice. A failed model load keeps the start button disabled.

Original desktop/authoring assets remain local. Unused generated web copies are
archived under ignored `artifacts/`. They are absent from production builds.

## Delivery and verification

The build validates all model references and copies HTML/CSS/ES modules, the ten
GLBs, the pinned Three.js runtime/addons, and the local Meshopt decoder. There is
no CDN dependency, database, runtime authoring or API key. Vercel serves the static
output; Docker runs the same output with a dependency-free non-root Node server.

Node tests cover movement, collision, energy, interaction distance, character
selection and HTTP behavior. Model checks decode every playable file, verify
80-joint skins and locomotion clips, and reject non-finite mesh data. Browser QA
exercises selection, actual player movement, jumping, pause and mobile controls.
