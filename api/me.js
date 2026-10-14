/** Giriş yapan hesabın adı/e-postası ve plan bilgisi. Girişten sonra bir kez çağrılır. */

const { PROFILE_URL, authHeaders, bearer, send, upstreamError } = require('./_anthropic');

module.exports = async (req, res) => {
  const token = bearer(req);
  if (!token) return send(res, 401, { ok: false, code: 'NO_TOKEN', message: 'Giriş gerekli.' });

  try {
    const r = await fetch(PROFILE_URL, { headers: authHeaders(token) });
    if (r.status === 401) {
      return send(res, 401, { ok: false, code: 'TOKEN_EXPIRED', message: 'Oturum süresi doldu.' });
    }
    if (!r.ok) return upstreamError(res, r);

    const j = await r.json();
    const acc = j.account || {};
    const org = j.organization || {};
    return send(res, 200, {
      ok: true,
      email: acc.email || null,
      name: acc.display_name || acc.full_name || null,
      plan: acc.has_claude_max ? 'max' : acc.has_claude_pro ? 'pro' : (org.organization_type || 'free'),
    });
  } catch (e) {
    return send(res, 500, { ok: false, code: 'ERROR', message: String(e.message || e) });
  }
};
