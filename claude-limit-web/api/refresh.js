/** Süresi dolan erişim token'ını yeniler. Token'lar yine tarayıcıda kalır. */

const { send, exchange } = require('./_anthropic');

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'POST bekleniyor.' });

  const { refresh_token } = readBody(req);
  if (!refresh_token) return send(res, 400, { ok: false, message: 'Yenileme token\'ı eksik.' });

  try {
    const { status, json } = await exchange({ grant_type: 'refresh_token', refresh_token });

    if (status !== 200 || !json.access_token) {
      return send(res, 401, {
        ok: false,
        code: 'REFRESH_FAILED',
        message: 'Oturum yenilenemedi, tekrar giriş yapman gerekiyor.',
      });
    }

    return send(res, 200, {
      ok: true,
      access_token: json.access_token,
      // Yenileme sırasında yeni bir refresh token dönerse eskisi geçersiz olur
      refresh_token: json.refresh_token || refresh_token,
      expires_at: json.expires_in ? Date.now() + json.expires_in * 1000 : null,
    });
  } catch (e) {
    return send(res, 500, { ok: false, message: String(e.message || e) });
  }
};
