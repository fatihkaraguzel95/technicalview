/**
 * Telefon için bağımsız bir Claude kimliği üretir.
 *
 * Neden gerekli: panelin kullanım verisini okuyabilmesi için "profil" izni olan
 * bir kimlik şart. `claude setup-token` bu izni vermiyor (403 döner). Bilgisayardaki
 * Claude Code kimliği ise paylaşılamıyor — yenileme anahtarı her tazelemede
 * değişiyor, paylaşılırsa taraflardan biri oturumdan düşüyor. Bu betik ayrı bir
 * giriş yapar: ürettiği kimliğin kendi yenileme zinciri olur, Claude Code'a dokunmaz.
 *
 * Akış, kurulu Claude Code 2.1.260'ın kendi giriş akışının birebir karşılığı:
 * yerel bir geri dönüş adresi açılır, tarayıcı kodu doğrudan oraya bırakır.
 * Kopyala-yapıştır yok.
 *
 * Çalıştırma:   node giris-al.js
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Claude Code 2.1.260 yapılandırmasından birebir
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTHORIZE_URL = 'https://claude.com/cai/oauth/authorize';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const SCOPES = [
  'org:create_api_key',
  'user:profile',
  'user:inference',
  'user:sessions:claude_code',
  'user:mcp_servers',
  'user:file_upload',
];

const LOG = path.join(__dirname, 'giris-log.txt');
const OUT = path.join(__dirname, 'telefon-kodu.txt');
const ACICI = path.join(__dirname, 'giris-ac.html');

const log = [];
function kaydet(s) {
  log.push(new Date().toISOString() + '  ' + s);
  fs.writeFileSync(LOG, log.join('\n') + '\n');
}

const b64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function authorizeUrl(challenge, state, redirect) {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.append('code', 'true');
  u.searchParams.append('client_id', CLIENT_ID);
  u.searchParams.append('response_type', 'code');
  u.searchParams.append('redirect_uri', redirect);
  u.searchParams.append('scope', SCOPES.join(' '));
  u.searchParams.append('code_challenge', challenge);
  u.searchParams.append('code_challenge_method', 'S256');
  u.searchParams.append('state', state);
  return u.toString();
}

/** Tarayıcıya gösterilecek basit sayfa. */
function sayfa(baslik, mesaj, renk) {
  return '<!doctype html><meta charset="utf-8"><title>' + baslik + '</title>' +
    '<body style="background:#000;color:#f5f3ef;font-family:system-ui;' +
    'display:flex;align-items:center;justify-content:center;height:100vh;margin:0">' +
    '<div style="max-width:420px;padding:24px;text-align:center">' +
    '<div style="font-size:42px;color:' + renk + '">&#9679;</div>' +
    '<h2 style="font-weight:700;margin:14px 0">' + baslik + '</h2>' +
    '<p style="color:#8a8780;line-height:1.6">' + mesaj + '</p></div>';
}

function bosPortBul() {
  return new Promise((cozumle) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => cozumle(p));
    });
  });
}

(async () => {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const port = await bosPortBul();
  const REDIRECT = 'http://localhost:' + port + '/callback';
  const url = authorizeUrl(challenge, state, REDIRECT);

  kaydet('port=' + port + ' redirect=' + REDIRECT);
  kaydet('scope=' + SCOPES.join(' '));
  kaydet('adres: ' + url);

  // Adresi & yüzünden kabuk bozmasın diye yerel bir HTML dosyası üzerinden açıyoruz
  const kacir = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  fs.writeFileSync(ACICI,
    '<!doctype html><meta charset="utf-8"><title>Claude girisi</title>' +
    '<meta http-equiv="refresh" content="1;url=' + kacir(url) + '">' +
    '<body style="background:#000;color:#f5f3ef;font-family:system-ui;' +
    'max-width:640px;margin:0 auto;padding:48px 24px;line-height:1.6">' +
    '<h2>Claude giris sayfasi aciliyor</h2>' +
    '<p style="color:#8a8780">Yonlendirilmezsen asagidaki baglantiya tikla.</p>' +
    '<p style="margin:22px 0"><a href="' + kacir(url) + '" ' +
    'style="color:#d97757;font-size:17px;font-weight:600">Claude giris sayfasini ac</a></p>'
  );

  console.log('');
  console.log('  Claude girisi');
  console.log('  ------------------------------------------------------------');
  console.log('  Tarayici acilacak. Acilan sayfada "Authorize" / "Izin ver" de.');
  console.log('  Gerisi otomatik — kod kopyalaman gerekmiyor.');
  console.log('');
  console.log('  Tarayici acilmazsa su dosyaya cift tikla:');
  console.log('  ' + ACICI);
  console.log('');
  console.log('  Bekleniyor...');

  const sunucu = http.createServer(async (istek, yanit) => {
    const gelen = new URL(istek.url, 'http://localhost:' + port);
    if (gelen.pathname !== '/callback') { yanit.writeHead(404).end(); return; }

    const hata = gelen.searchParams.get('error');
    const kod = gelen.searchParams.get('code');
    const donenState = gelen.searchParams.get('state');
    kaydet('callback: hata=' + hata + ' kod_var=' + Boolean(kod) + ' state_uyum=' + (donenState === state));

    if (hata || !kod) {
      const aciklama = gelen.searchParams.get('error_description') || hata || 'kod gelmedi';
      yanit.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      yanit.end(sayfa('Giris basarisiz', aciklama, '#d9574f'));
      console.log('\n  BASARISIZ: ' + aciklama);
      console.log('  Ayrintilar: ' + LOG);
      sunucu.close(); return;
    }

    try {
      const govde = {
        grant_type: 'authorization_code',
        code: kod,
        redirect_uri: REDIRECT,
        client_id: CLIENT_ID,
        code_verifier: verifier,
        state: donenState || state,
      };
      const r = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde),
      });
      const metin = await r.text();
      kaydet('token ucu: HTTP ' + r.status + '  ' + metin.slice(0, 300).replace(/\s+/g, ' '));

      let j = {};
      try { j = JSON.parse(metin); } catch {}

      if (r.status !== 200 || !j.access_token) {
        yanit.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        yanit.end(sayfa('Token alinamadi', 'HTTP ' + r.status, '#d9574f'));
        console.log('\n  BASARISIZ — token ucu HTTP ' + r.status);
        console.log('  ' + metin.slice(0, 200));
        console.log('  Ayrintilar: ' + LOG);
        sunucu.close(); return;
      }

      // Kimlik gercekten kullanim verisi okuyabiliyor mu?
      const kontrol = await fetch('https://api.anthropic.com/api/oauth/usage', {
        headers: { Authorization: 'Bearer ' + j.access_token, 'anthropic-beta': 'oauth-2025-04-20' },
      });
      kaydet('kullanim ucu kontrolu: HTTP ' + kontrol.status);

      if (kontrol.status !== 200) {
        yanit.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        yanit.end(sayfa('Kimlik yetersiz', 'Kullanim verisi okunamiyor (HTTP ' + kontrol.status + ')', '#d9a13f'));
        console.log('\n  Giris oldu ama kimlik kullanim verisini OKUYAMIYOR (HTTP ' + kontrol.status + ').');
        console.log('  Ayrintilar: ' + LOG);
        sunucu.close(); return;
      }

      const paket = 'claude-limit:' + b64url(Buffer.from(JSON.stringify({
        a: j.access_token,
        r: j.refresh_token || null,
        e: j.expires_in ? Date.now() + j.expires_in * 1000 : null,
      })));
      fs.writeFileSync(OUT, paket + '\n');
      kaydet('BASARILI');

      yanit.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      yanit.end(sayfa('Giris basarili', 'Bu sekmeyi kapatabilirsin. Devami terminalde.', '#4ba36a'));

      console.log('');
      console.log('  BASARILI — kimlik calisiyor ve kullanim verisini okuyabiliyor.');
      console.log('  ------------------------------------------------------------');
      console.log('  Telefona yapistiracagin kod su dosyada:');
      console.log('');
      console.log('  ' + OUT);
      console.log('');
      console.log('  Dosyayi ac, icindeki tek satiri kopyala, panelde');
      console.log('  "Gelismis: token yapistirarak gir" bolumune yapistir.');
      console.log('');
      console.log('  Bu bir anahtardir: kimseyle paylasma.');
      sunucu.close();
    } catch (e) {
      kaydet('istisna: ' + String(e && e.message || e));
      yanit.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      yanit.end(sayfa('Hata', String(e && e.message || e), '#d9574f'));
      console.log('\n  HATA: ' + String(e && e.message || e));
      sunucu.close();
    }
  });

  sunucu.listen(port, '127.0.0.1', () => {
    if (!process.env.ACMA) {
      try { spawn('explorer.exe', [ACICI], { detached: true, stdio: 'ignore' }).unref(); } catch {}
    }
  });

  setTimeout(() => {
    console.log('\n  Zaman asimi (5 dk). Betigi tekrar calistir.');
    try { sunucu.close(); } catch {}
    process.exit(1);
  }, 300000).unref?.();
})();
