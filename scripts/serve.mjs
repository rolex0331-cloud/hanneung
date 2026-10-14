// dist/를 Cloudflare Pages처럼 제공하는 로컬 서버 (없는 경로는 404.html)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
export function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = async (f, code = 200) => { res.writeHead(code, { 'content-type': T[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); };
    try {
      let f = normalize(join(root, decodeURIComponent(url.pathname)));
      if (!f.startsWith(root)) throw 0;
      if ((await stat(f).catch(() => null))?.isDirectory()) f = join(f, 'index.html');
      await stat(f);
      await send(f);
    } catch { await send(join(root, '404.html'), 404); }
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const s = await startServer(Number(process.env.PORT || 8090)); console.log(`http://127.0.0.1:${s.address().port}/`); }
