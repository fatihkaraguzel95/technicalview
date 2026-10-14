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

  const { code, verifier, redirect_uri } = readBody(req);
  if (!code || !verifier) {
    return send(res, 400, { ok: false, message: 'Kod veya doğrulayıcı eksik.' });
  }

  // claude.ai kodu "KOD#STATE" biçiminde verebiliyor
  const [rawCode, state] = String(code).trim().split('#');

  try {
    const { status, json } = await exchange({
      grant_type: 'authorization_code',
      code: rawCode,
      redirect_uri: redirect_uri || 'https://console.anthropic.com/oauth/code/callback',
      code_verifier: verifier,
      state: state || undefined,
    });

    if (status !== 200 || !json.access_token) {
      const detay = json.error_description ? ' (' + json.error_description + ')' : '';
      return send(res, 400, {
        ok: false,
        code: json.error || 'EXCHANGE_FAILED',
        message: KOD_HATASI + detay,
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
