// Zero-dependency static server, just enough to serve ES modules over http
// (file:// blocks module imports).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const PORT = process.env.PORT || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const send = (res, code, body, type) => {
  // no-store, or an edit stays invisible behind the disk cache
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
};

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  // /minted/<address or name> is the minted page filtered by slug.
  // vercel.json rewrites it in production; mirror it here.
  if (/^\/minted\/[^/]+$/.test(path)) path = '/minted.html';
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, safe);

  // vercel.json sets cleanUrls, so production serves /about from about.html.
  // Mirror it, or every local URL differs from the real one by a .html and
  // links that work in production 404 here.
  const candidates = extname(file) ? [file] : [file, `${file}.html`];

  for (const candidate of candidates) {
    try {
      const body = await readFile(candidate);
      return send(res, 200, body, TYPES[extname(candidate)] || 'application/octet-stream');
    } catch { /* try the next candidate */ }
  }

  // Vercel serves 404.html for unmatched routes on a static deploy.
  try {
    return send(res, 404, await readFile(join(ROOT, '404.html')), TYPES['.html']);
  } catch {
    return send(res, 404, 'not found', 'text/plain');
  }
}).listen(PORT, () => {
  console.log(`\n  WHAT DO I GET?  →  http://localhost:${PORT}\n`);
});
