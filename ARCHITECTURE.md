# Pawtown Nightfall architecture

## Simulation and rendering

The Three.js viewport is a rainy, foggy nighttime town. The ten-dog selection
menu hands control to the selected animated model. `choose`, `playing`, `paused`
and `caught` explicitly control input, simulation and overlays. NPCs are local;
there are no fabricated online players or database requirements.

`engine.mjs` accumulates a bounded frame delta into 60 Hz simulation steps.
Movement, collision, patrol decisions and projectiles use those steps. The
player's rendered position interpolates the previous/current simulation states.
Rendering, rain and skeletal sampling follow the display rate. Pausing freezes
simulation and animation; camera damping remains independent of simulation.
HUD snapshots are produced roughly every 80 ms, rather than allocating the
resident/map/status arrays on every rendered frame. Collider objects and camera
vectors are reused.

## Animation

`animation.mjs` blends Idle, Walk, Trot and Gallop continuously using authored
gait-speed references scaled to the dog's world height. Gaits share a
travel-driven normalized phase and are not reset at threshold crossings. Weights
and speed ease with elapsed time; tiny inactive weights are removed and the
remaining weights normalized. The mixer samples gait clips at the shared phase,
while idle breathing and one-shot gestures use time normally.

Only four gaits plus Bark and Lie_Idle get mixer actions; other source clips
remain available in the files without allocating unused animation bindings.
Gestures blend with locomotion and return to a total weight of one. A short
procedural body recoil accompanies a hit. Resident limb phase is driven by
actual travelled distance, with eased turn, stride and attack-arm motion. Ambient
dogs also use measured travel speed for their gait and flee nearby hostile NPCs
using the same collision-aware movement.

## Threats and survival

`threats.mjs` contains a renderer-independent state machine:

`patrol → suspicious → chase → windup → recover`, with a finite `search` after
losing the dog. Sight depends on distance, facing and world obstacles. Sprinting
and barking affect perception. Inactive play and refuge occupancy cancel attacks.

`residents.mjs` applies those decisions to three hostile NPCs and keeps the other
five neutral/helpful. Pursuers use collision-aware movement. Windups display a
world-space ring at a locked aim point and an overhead warning. A throw follows
a visible arc; a close shove is resolved only within reach. Once an attack starts,
its aim does not track a dodging player.

Projectiles use a small reusable pool, swept sphere hit tests, obstacle checks
and a lifetime limit. Damage has an invulnerability interval, recoil and a brief
input slowdown. It cannot affect the dog inside a refuge. Three hits enter the
caught overlay; retry restores health and removes stale projectiles. Supplies
plus a return to refuge complete the current run. E restores health/energy at a
refuge, with a short rest cooldown. Attacks are non-graphic.

## Atmosphere and assets

`world.mjs` retains the existing town geometry with a cold, desaturated palette,
wet pavement, closed shops, sparse amber lamps and marked refuges. Point lights
are bounded and do not cast additional shadows. A moon directional light follows
the player; mobile uses a smaller shadow map. `weather.mjs` generates a small
rain line buffer and procedural surface texture. No remote art or CDN is needed.

`roster.mjs` and the asset validator enforce exactly ten playable IDs. Existing
Meshopt GLBs, local Three.js and the decoder produce an approximately 35 MB build.
`assets.mjs` clones skin hierarchies, protects resources used by current/ambient
dogs and evicts unused entries beyond a three-model cache. Selection tokens
prevent late previous loads from replacing a newer choice.

## Verification and deployment

Node tests exercise motion/collision, mixer weight/phase continuity, gestures,
patrol perception, telegraph duration, locked aim, loss of sight, safe zones,
projectile sweeps and HTTP behavior. Browser checks cover real attacks/damage,
dodging, refuge healing, caught/retry cleanup, ten-model selection, pause and
native mobile touch input. Source-model decoding checks retain rig/clip validity.

Vercel serves the static build. Docker packages the same files behind the
non-root Node static server; the app has no runtime database or API secret.
Original desktop/authoring inputs remain local and unchanged.
