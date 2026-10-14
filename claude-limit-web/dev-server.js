/**
 * Yerel geliştirme sunucusu.
 *
 * Vercel'in /api/*.js fonksiyonlarını çalıştırma biçimini taklit eder, böylece
 * değişiklikleri deploy etmeden önce burada denemek mümkün olur.
 * Yayına çıkan kurulumda bu dosya kullanılmaz.
 *
 *   node dev-server.js   ->  http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

/** Vercel'in res nesnesindeki yardımcıları ekler. */
function wrap(res) {
  res.status = function (c) { res.statusCode = c; return res; };
  res.send = function (b) { res.end(b); };
  return res;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (!raw) return resolve(undefined);
      try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).split('/')[0];
    const file = path.join(__dirname, 'api', name + '.js');
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('fonksiyon yok: ' + name);
      return;
    }
    delete require.cache[require.resolve(file)];     // her istekte taze yükle
    const handler = require(file);
    req.body = await readBody(req);
    try {
      await handler(req, wrap(res));
    } catch (e) {
      console.error('[api/' + name + ']', e);
      if (!res.headersSent) res.writeHead(500).end(String(e.message || e));
    }
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  let norm = path.normalize(rel);
  while (norm.startsWith('/') || norm.startsWith(path.sep)) norm = norm.slice(1);
  const file = path.join(PUBLIC_DIR, norm);
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('404'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log('Gelistirme sunucusu: http://localhost:' + PORT);
});
