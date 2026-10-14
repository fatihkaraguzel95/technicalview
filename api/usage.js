/** Kullanım yüzdelerini döndürür. Token istekle gelir, saklanmaz. */

const { USAGE_URL, authHeaders, bearer, send, shapeUsage } = require('./_anthropic');

module.exports = async (req, res) => {
  const token = bearer(req);
  if (!token) return send(res, 401, { ok: false, code: 'NO_TOKEN', message: 'Giriş gerekli.' });

  try {
    const r = await fetch(USAGE_URL, { headers: authHeaders(token) });

    if (r.status === 401) {
      return send(res, 401, { ok: false, code: 'TOKEN_EXPIRED', message: 'Oturum süresi doldu.' });
    }
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 200);
      return send(res, 502, { ok: false, code: 'UPSTREAM', message: 'Anthropic ' + r.status + ': ' + detail });
    }

    return send(res, 200, shapeUsage(await r.json()));
  } catch (e) {
    return send(res, 500, { ok: false, code: 'ERROR', message: String(e.message || e) });
  }
};
