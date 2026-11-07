// Tiny local preview server with no dependencies.
// Usage: npm run serve, then open http://127.0.0.1:8080 (Ctrl+C stops it).
// It only listens on this computer and only serves files inside the project folder.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Never serve hidden files or folders such as .git, and never leave the project folder.
  if (pathname.split('/').some((part) => part.startsWith('.'))) return send(res, 404, 'Not found');
  const filePath = resolve(ROOT, `.${pathname}`);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) return send(res, 403, 'Forbidden');

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return send(res, 404, 'Not found');
    const body = await readFile(filePath);
    const type = TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
    return send(res, 200, req.method === 'HEAD' ? undefined : body, type);
  } catch {
    return send(res, 404, 'Not found');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other server or run with a different PORT.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Previewing ${ROOT}`);
  console.log(`Open http://${HOST}:${PORT} in your browser. Press Ctrl+C to stop.`);
});
