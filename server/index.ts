import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { horizonsMiddleware } from './horizons';
import { securityHeaders } from '../config/securityHeaders';
import { landingMiddleware } from './landingApi';

const root = path.resolve('dist');
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.stl': 'application/octet-stream' };
const server = createServer((request, response) => {
  for (const [key, value] of Object.entries(securityHeaders())) response.setHeader(key, value);
  landingMiddleware(request,response,()=>horizonsMiddleware(request, response, () => {
    void (async () => {
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
      let pathname: string;
      try { pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
      const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
      try {
        const info = await stat(file);
        if (!info.isFile()) { response.writeHead(404).end(); return; }
        response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
        response.setHeader('Content-Length', info.size);
        if (request.method === 'HEAD') response.end(); else createReadStream(file).on('error', () => response.destroy()).pipe(response);
      } catch { response.writeHead(404).end(); }
    })();
  }));
});
server.requestTimeout = 400000;
server.listen(Number(process.env.PORT || 4173), process.env.HOST || '127.0.0.1', () => console.log('Moon Mission server ready'));
