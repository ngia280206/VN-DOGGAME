import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

export function createStaticServer(directory) {
  const rootPromise = realpath(resolve(directory));
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const root = await rootPromise;
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname.includes('\0')) { response.writeHead(400).end(); return; }
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      // Resolve symlinks too, so only files inside the built website can be served.
      const actual = await realpath(file);
      if (!actual.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      const info = await stat(actual);
      if (!info.isFile()) { response.writeHead(404).end(); return; }
      if (info.size === 0) {
        response.writeHead(200, { 'Content-Length': 0 }).end(); return;
      }
      let start = 0;
      let end = info.size - 1;
      let status = 200;
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!range || (!range[1] && !range[2])) {
          response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return;
        }
        start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
        end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
        if (start > end || start >= info.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
          response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return;
        }
        status = 206;
        response.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
      }
      response.setHeader('Content-Type', types[extname(actual)] || 'application/octet-stream');
      response.setHeader('Content-Length', end - start + 1);
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Cache-Control', /\.[a-f0-9]{16}\./.test(actual)
        ? 'public, max-age=31536000, immutable' : 'no-cache');
      response.writeHead(status);
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(actual, { start, end });
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 :
        ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500).end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 18080);
  const server = createStaticServer(fileURLToPath(new URL('./dist/', import.meta.url)));
  server.listen(port, '0.0.0.0', () => console.log(`Pawtown: http://localhost:${server.address().port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
}
