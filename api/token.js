/**
 * Giriş kodunu token'a çevirir.
 *
 * Tarayıcı bunu doğrudan yapamıyor (Anthropic tarayıcıdan gelen isteklere
 * CORS izni vermiyor), o yüzden istek buradan geçiyor. Sonuç tarayıcıya
 * döner ve orada kalır — burada hiçbir şey saklanmaz.
 */

const { send, exchange } = require('./_anthropic');

const KOD_HATASI =
  'Kod geçersiz ya da süresi dolmuş. "Claude sayfasını tekrar aç" deyip yeni bir kod al.';

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'POST bekleniyor.' });

  const { code, verifier, redirect_uri, state } = readBody(req);
  if (!code || !verifier) {
    return send(res, 400, { ok: false, message: 'Kod veya doğrulayıcı eksik.' });
  }

  // Kod "KOD#STATE" biçiminde gelebiliyor; gelmezse girişte saklanan state kullanılır.
  // state'siz istek token ucundan "Invalid request format" ile dönüyor, bu yüzden şart.
  const [rawCode, stateFromCode] = String(code).trim().split('#');
  const effectiveState = stateFromCode || state;
  if (!effectiveState) {
    return send(res, 400, { ok: false, message: 'Giriş adımı eksik. Giriş sayfasını tekrar aç.' });
  }

  try {
    const { status, json } = await exchange({
      grant_type: 'authorization_code',
      code: rawCode,
      redirect_uri: redirect_uri || 'https://platform.claude.com/oauth/code/callback',
      code_verifier: verifier,
      state: effectiveState,
    });

    if (status !== 200 || !json.access_token) {
      // İki hata biçimi dönebiliyor: OAuth tarzı {error, error_description}
      // ve Anthropic tarzı {error: {type, message}}
      const neden =
        (json.error && json.error.message) || json.error_description ||
        (typeof json.error === 'string' ? json.error : null);
      return send(res, 400, {
        ok: false,
        code: (json.error && json.error.type) || json.error || 'EXCHANGE_FAILED',
        message: KOD_HATASI + (neden ? ' (' + neden + ')' : ''),
      });
    }

    return send(res, 200, {
      ok: true,
      access_token: json.access_token,
      refresh_token: json.refresh_token || null,
      expires_at: json.expires_in ? Date.now() + json.expires_in * 1000 : null,
    });
  } catch (e) {
    return send(res, 500, { ok: false, message: String(e.message || e) });
  }
};
