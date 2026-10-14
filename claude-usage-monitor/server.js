/**
 * Claude Usage Monitor - yerel sunucu
 *
 * PC'deki Claude Code OAuth token'ini okur, Anthropic kullanim endpoint'ini
 * sorgular ve telefondan acilabilen siyah bir panel servis eder.
 *
 * Bagimlilik yok. Calistirma:  node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 7373);
const PUBLIC_DIR = path.join(__dirname, 'public');
const CRED_PATH = path.join(os.homedir(), '.claude', '.credentials.json');

// Ayni veriyi birden fazla istemci icin tekrar tekrar cekmemek adina
// sunucu tarafinda kisa omurlu onbellek.
const CACHE_MS = 20_000;
let cache = { at: 0, payload: null };

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

function readCredentials() {
  const raw = fs.readFileSync(CRED_PATH, 'utf8');
  const oauth = JSON.parse(raw).claudeAiOauth;
  if (!oauth || !oauth.accessToken) throw new Error('credentials dosyasinda accessToken yok');
  return oauth;
}

async function callUsage(token) {
  const res = await fetch(USAGE_URL, {
    headers: {
      Authorization: 'Bearer ' + token,
      'anthropic-beta': 'oauth-2025-04-20',
      'User-Agent': 'claude-usage-monitor/1.0',
    },
  });
  return res;
}

/** limits[] dizisinden bir grubu bul; yoksa eski alan adina dus. */
function pickLimit(usage, group, fallbackKey) {
  const hit = (usage.limits || []).find((l) => l.group === group || l.kind === group);
  if (hit) {
    return {
      percent: Math.round(hit.percent ?? 0),
      resets_at: hit.resets_at || null,
      severity: hit.severity || 'normal',
    };
  }
  const fb = usage[fallbackKey];
  if (fb) {
    return {
      percent: Math.round(fb.utilization ?? 0),
      resets_at: fb.resets_at || null,
      severity: 'normal',
    };
  }
  return null;
}

async function fetchUsage() {
  let oauth = readCredentials();
  let res = await callUsage(oauth.accessToken);

  // Token yenilenmis olabilir: dosyayi tekrar okuyup bir kez daha dene.
  // (Token yenilemeyi bilerek biz yapmiyoruz - refresh token rotasyonu
  //  Claude Code'un oturumunu bozabilir. Yenilemeyi Claude Code yapar.)
  if (res.status === 401) {
    await new Promise((r) => setTimeout(r, 300));
    oauth = readCredentials();
    res = await callUsage(oauth.accessToken);
  }

  if (res.status === 401) {
    const err = new Error('TOKEN_EXPIRED');
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }
  if (!res.ok) {
    throw new Error('Anthropic API ' + res.status + ': ' + (await res.text()).slice(0, 200));
  }

  const usage = await res.json();
  const session = pickLimit(usage, 'session', 'five_hour');
  const weekly = pickLimit(usage, 'weekly', 'seven_day');

  const rows = (usage.seven_day_breakdown && usage.seven_day_breakdown.rows) || [];

  return {
    ok: true,
    plan: oauth.subscriptionType || 'pro',
    tokenExpiresAt: oauth.expiresAt ? new Date(oauth.expiresAt).toISOString() : null,
    session,
    weekly,
    breakdown: rows
      .filter((r) => (r.percent ?? 0) > 0)
      .map((r) => ({ name: r.display_name || r.key, percent: Math.round(r.percent) })),
    fetchedAt: new Date().toISOString(),
  };
}

async function getUsageCached() {
  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_MS) {
    return { ...cache.payload, cached: true };
  }
  const payload = await fetchUsage();
  cache = { at: now, payload };
  return payload;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  let norm = path.normalize(rel);
  while (norm.startsWith('/') || norm.startsWith(path.sep)) norm = norm.slice(1);
  const file = path.join(PUBLIC_DIR, norm);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.split('?')[0] === '/api/usage') {
    try {
      const data = await getUsageCached();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    } catch (e) {
      const expired = e.code === 'TOKEN_EXPIRED';
      res.writeHead(expired ? 401 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          code: e.code || 'ERROR',
          message: expired
            ? 'Token suresi dolmus. PC\'de Claude Code\'u bir kez calistir, token otomatik yenilenir.'
            : String(e.message || e),
        })
      );
      console.error('[usage] hata:', e.message);
    }
    return;
  }
  serveStatic(req, res);
});

function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) {
        out.push({ name, address: a.address });
      }
    }
  }
  return out;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  Claude Usage Monitor calisiyor');
  console.log('  ------------------------------');
  console.log('  Bu PC        : http://localhost:' + PORT);
  for (const { name, address } of lanAddresses()) {
    console.log('  Telefon      : http://' + address + ':' + PORT + '   (' + name + ')');
  }
  console.log('');
  console.log('  Kapatmak icin Ctrl+C');
  console.log('');
});
