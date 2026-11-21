<<<<<<< HEAD
# VN-DOGGAME
||||||| (empty tree)
# 3D-Dog-Battle-Game
||||||| parent of 99f6e44 (Add static dog model viewer with Docker and Vercel builds)
# 3D-Dog-Battle-Game
=======
# Dog Motion Lab

A browser model library with 317 animated dogs: 294 breed/body/age variants and
23 saved custom models. No database, account, photo scanning or API key is needed.

Browse by breed and life stage, search Vietnamese names with or without accents,
switch animation clips, pause playback, orbit/zoom, and remember the selected dog
in browser storage. A `?dog=MODEL_ID` URL opens a particular companion.

## Run with Docker

```sh
docker build -t dog-motion-lab:latest .
docker run --rm --name dog-motion-lab -p 127.0.0.1:18081:8080 dog-motion-lab:latest
```

Open **http://localhost:18081**. The image runs as a non-root user and serves static
files on port 8080. `GET /healthz` is its health check. To use another host port,
change the first `18081` in the `-p` argument.

If Docker Compose is installed, `docker compose up --build -d` uses the included
`compose.yaml` with a read-only container filesystem. On this Mac, start the
Docker engine first with `colima start` when it is stopped.

## Run without Docker

Use Node.js 24 LTS (Node.js 22.12+ is supported):

```sh
npm ci
npm test
npm run build
npm start
```

Open **http://localhost:18080**. After editing `web/`, rebuild and refresh the page.
`PORT` changes the standalone server's listening port.

## Deploy from GitHub to Vercel

1. Import this GitHub repository as a new Vercel project.
2. Use the repository root as the Root Directory and **Other** as the framework.
3. Set the Build Command to `npm run build` and Output Directory to `dist`.
4. Deploy. No database, environment variables or API keys are required.

`vercel.json` supplies the build/output configuration and model-cache headers.
Vercel builds the static website directly from the repository; the Dockerfile
provides the equivalent local/self-hosted package. Importing the Git repository
avoids uploading this large model library through the CLI. See the official
[Vercel Git deployment guide](https://vercel.com/docs/git).

## Models and repository size

`public/catalog.json` and `public/models/` contain all 317 web-ready models.
Meshopt compression, animation-track optimization and 1024px WebP textures reduce
7.91 GB of original exports to about 1.09 GB. Models load only when selected;
the viewer and decoder are served locally rather than from a third-party CDN.

Original `assets/*.glb`, cached ear models and `Textures/` remain on the authoring
machine and are excluded from Git and Docker. They are not needed to build or run
the web version. They have not been overwritten or deleted. The web exports use
smaller textures and quantized geometry; they are not byte-identical originals.

To regenerate web copies on a machine with the original assets:

```sh
npm run models:prepare
node scripts/check-web-models.mjs
npm run build
```

Asset source notices and restrictions are retained under `public/licenses/`.
These models are included for this application; source-model redistribution
restrictions still apply.

## Layout

- `web/`: browser interface, filters, selection and playback controls.
- `public/`: portable catalog, compressed animated models and source notices.
- `scripts/`: static build, web-model export/validation and Node tests.
- `server.mjs`: dependency-free static server used by Docker and `npm start`.
- `Dockerfile`, `compose.yaml`, `vercel.json`: deployment configuration.
- `dog_library.py`, `play_park.py`: retained Panda3D desktop applications.
- `dog_*.py`, `tools/`, `tests/`: retained model authoring and Python regressions.

The Python desktop apps and geometry tests require the original local `assets/`
and `Textures/` inputs. A fresh Git checkout includes the browser-ready exports;
it does not include those original authoring inputs.

## Validation

```sh
npm test
npm run build
node scripts/check-web-models.mjs
```

The compressed-model checker decodes the entire library using the browser
viewer's decoder and checks all 80-joint rigs, locomotion clips and mesh arrays.
The server tests exercise HTTP methods, partial downloads and path containment.

On the original authoring machine, Python regressions remain available:

```sh
.venv/bin/python -B -m unittest discover -s tests -v
```
>>>>>>> 99f6e44 (Add static dog model viewer with Docker and Vercel builds)
