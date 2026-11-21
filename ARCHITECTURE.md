# Architecture

## Browser application

`web/` is a static model viewer built around the self-hosted `<model-viewer>`
component. `catalog.mjs` contains filtering and selection logic, independent of
rendering. `main.mjs` connects that state to the UI, model loading and animation
controls. The last selected dog is optional browser-local state.

`public/catalog.json` describes the 317 available dogs using relative asset URLs.
The browser fetches the selected compressed GLB on demand. Its cache retains at
most two models; it does not preload the whole library. No database or backend
application service is used.

## Build and delivery

`npm run build` validates every asset reference, copies `web/` and `public/` to
`dist/`, and adds the locked model-viewer bundle and local Meshopt decoder.
Deployments never run Blender or need the original 8 GB of models.

Vercel serves the static `dist/` output from the GitHub source. The Docker image
builds that same output in a Node builder stage, then serves it using a small,
non-root Node runtime. `server.mjs` supports HEAD and byte ranges, rejects writes,
and prevents traversal or symlink access outside `dist/`. Compose additionally
runs the container with a read-only filesystem.

Model URLs include a fingerprint of the original file and export settings. They
can be cached as immutable; the catalog is revalidated. Source license notices
are included in the website and image.

## Original assets and authoring

`dog_catalog.json` describes 294 base variants and `custom_catalog.json` describes
23 standalone custom models. `scripts/prepare-web-models.mjs` reads these original
local GLBs, optimizes repeated accessors/animation tracks, compresses the geometry
and animation data with Meshopt, and creates smaller WebP textures. It writes new
files under `public/models/`; it never modifies the originals.

The full source files under `assets/` and `Textures/` stay local and are excluded
from Git and the Docker build context. The prebuilt web copies are tracked so a
fresh checkout can build without proprietary authoring inputs or Blender.

The retained Python desktop entry points use `catalog.py` to access base and
saved exports. This module imports only the standard library. `model_assets.py`
provides cached GLB metadata and offline binary access without SciPy or Pillow.
`tools/` holds explicit asset-authoring and validation commands; it never runs
from a browser request or the desktop render loop.

## Verification

Node tests cover filtering, remembered/shared selection, static HTTP delivery,
byte ranges and filesystem containment. `scripts/check-web-models.mjs` decodes
all compressed files with the same Meshopt decoder used by the viewer, checks
80-joint skins and locomotion clips, and verifies finite geometry arrays.

Python tests retain geometry, groom, developmental proportion and movement
coverage on the original authoring machine. Large review artifacts remain
ignored. Scanning, recognition, fitting and API calls have been removed.
