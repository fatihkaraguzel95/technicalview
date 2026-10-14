/**
 * Telefon için bağımsız bir Claude kimliği üretir.
 *
 * Neden gerekli: panelin kullanım verisini okuyabilmesi için "profil" izni olan
 * bir kimlik şart. `claude setup-token` bu izni vermiyor. Bilgisayardaki Claude
 * Code kimliği ise paylaşılamıyor — yenileme anahtarı her tazelemede değişiyor,
 * paylaşılırsa iki taraftan biri oturumdan düşüyor.
 *
 * Bu betik ayrı bir giriş yapar: ürettiği kimliğin kendi yenileme zinciri olur,
 * Claude Code oturumuna dokunmaz.
 *
 * Çalıştırma (PowerShell'de):   node giris-al.js
 */

const crypto = require('crypto');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const REDIRECT = 'https://platform.claude.com/oauth/code/callback';
const SCOPES = 'user:profile user:inference user:sessions:claude_code user:mcp_servers';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';

const LOG = path.join(__dirname, 'giris-log.txt');
const OUT = path.join(__dirname, 'telefon-kodu.txt');

const log = [];
function kaydet(satir) {
  log.push(new Date().toISOString() + '  ' + satir);
  fs.writeFileSync(LOG, log.join('\n') + '\n');
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function authorizeUrl(challenge, state) {
  const p = [
    ['code', 'true'],
    ['client_id', CLIENT_ID],
    ['response_type', 'code'],
    ['redirect_uri', REDIRECT],
    ['scope', SCOPES],
    ['code_challenge', challenge],
    ['code_challenge_method', 'S256'],
    ['state', state],
  ];
  return 'https://claude.ai/oauth/authorize?' +
    p.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}

function sor(soru) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(soru, (c) => { rl.close(); r(c.trim()); }));
}

(async () => {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  const url = authorizeUrl(challenge, state);

  kaydet('giris adresi uretildi, scope=' + SCOPES + ' redirect=' + REDIRECT);

  console.log('');
  console.log('  ADIM 1 — Tarayicida izin ver');
  console.log('  ------------------------------------------------------------');
  console.log('  Birazdan tarayici acilacak. Acilmazsa su adresi kendin ac:');
  console.log('');
  console.log('  ' + url);
  console.log('');
  console.log('  Acilan sayfada "Authorize" / "Izin ver" butonuna bas.');
  console.log('  Ardindan ekranda bir KOD cikacak, onu kopyala.');
  console.log('');

  try { spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref(); } catch {}

  const kod = await sor('  ADIM 2 — Kodu buraya yapistir ve Enter: ');
  if (!kod) { console.log('  Kod girilmedi, cikiliyor.'); return; }

  const [rawCode, stateFromCode] = kod.split('#');
  kaydet('kod alindi, uzunluk=' + rawCode.length + ', kod icinde state var mi=' + Boolean(stateFromCode));

  console.log('');
  console.log('  Kod token\'a cevriliyor...');

  const govde = {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code: rawCode,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
    state: stateFromCode || state,
  };

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(govde),
  });
  const metin = await r.text();
  kaydet('token ucu yaniti: HTTP ' + r.status + '  ' + metin.slice(0, 400).replace(/\s+/g, ' '));

  let j = {};
  try { j = JSON.parse(metin); } catch {}

  if (r.status !== 200 || !j.access_token) {
    console.log('');
    console.log('  BASARISIZ — HTTP ' + r.status);
    console.log('  Yanit: ' + metin.slice(0, 300));
    console.log('');
    console.log('  Ayrintilar su dosyaya yazildi: ' + LOG);
    console.log('  Bu dosyayi Claude Code\'a bildir, oradan devam edilir.');
    return;
  }

  // Kimligin gercekten kullanim verisi okuyabildigini dogrula
  const kontrol = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: { Authorization: 'Bearer ' + j.access_token, 'anthropic-beta': 'oauth-2025-04-20' },
  });
  kaydet('kullanim ucu kontrolu: HTTP ' + kontrol.status);

  if (kontrol.status !== 200) {
    console.log('');
    console.log('  Giris basarili ama bu kimlik kullanim verisini OKUYAMIYOR (HTTP ' + kontrol.status + ').');
    console.log('  Ayrintilar: ' + LOG);
    return;
  }

  const paket = 'claude-limit:' + b64url(Buffer.from(JSON.stringify({
    a: j.access_token,
    r: j.refresh_token || null,
    e: j.expires_in ? Date.now() + j.expires_in * 1000 : null,
  })));

  fs.writeFileSync(OUT, paket + '\n');
  kaydet('BASARILI, paket yazildi');

  console.log('');
  console.log('  BASARILI — kimlik calisiyor ve kullanim verisini okuyabiliyor.');
  console.log('  ------------------------------------------------------------');
  console.log('  Telefona yapistiracagin kod su dosyaya yazildi:');
  console.log('');
  console.log('  ' + OUT);
  console.log('');
  console.log('  Dosyayi ac, icindeki tek satiri kopyala, panelde');
  console.log('  "Gelismis: token yapistirarak gir" bolumune yapistir.');
  console.log('');
  console.log('  Bu kod bir anahtardir: kimseyle paylasma.');
})();
