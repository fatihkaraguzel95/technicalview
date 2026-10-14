/**
 * Anthropic uç noktaları için ortak yardımcılar.
 *
 * Buradaki hiçbir fonksiyon token saklamaz. Token tarayıcıda durur,
 * her istekte gelir, Anthropic'e iletilir ve unutulur.
 */

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'; // Claude Code OAuth istemcisi
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const PROFILE_URL = 'https://api.anthropic.com/api/oauth/profile';
const UA = 'claude-limit-web/1.0';

function authHeaders(token) {
  return {
    Authorization: 'Bearer ' + token,
    'anthropic-beta': 'oauth-2025-04-20',
    'User-Agent': UA,
  };
}

/** İstekteki Authorization başlığından token'ı çıkarır. */
function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/** Bir sonucu her zaman önbelleksiz döndür. */
function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
}

/** limits[] dizisinden bir grubu bul; yoksa eski alan adına düş. */
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
    return { percent: Math.round(fb.utilization ?? 0), resets_at: fb.resets_at || null, severity: 'normal' };
  }
  return null;
}

/** Ham kullanım yanıtını panelin beklediği sade biçime çevirir. */
function shapeUsage(usage) {
  const rows = (usage.seven_day_breakdown && usage.seven_day_breakdown.rows) || [];
  return {
    ok: true,
    session: pickLimit(usage, 'session', 'five_hour'),
    weekly: pickLimit(usage, 'weekly', 'seven_day'),
    breakdown: rows
      .filter((r) => (r.percent ?? 0) > 0)
      .map((r) => ({ name: r.display_name || r.key, percent: Math.round(r.percent) })),
    fetchedAt: new Date().toISOString(),
  };
}

/** Token takası / yenileme isteklerini Anthropic'e iletir. */
async function exchange(body) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ ...body, client_id: CLIENT_ID }),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { error: 'bad_response', raw: text.slice(0, 200) }; }
  return { status: r.status, json };
}

/**
 * Üst sunucunun hatasını olduğu gibi yüzeye çıkarır.
 *
 * Genel bir "Anthropic 403" mesajı teşhis için işe yaramıyordu: yetki kapsamı
 * sorunu mu, güvenlik duvarı engeli mi, ayırt edilemiyordu. Gövdenin bir
 * bölümünü de taşıyoruz.
 */
async function upstreamError(res, r) {
  let govde = '';
  try { govde = (await r.text()).slice(0, 300).replace(/\s+/g, ' ').trim(); } catch {}

  const ipuclari = {
    403: 'Yetki reddedildi. Giriş kodunun kapsamı yetersiz olabilir ya da ' +
         'Anthropic bu sunucudan gelen isteği engelliyor olabilir.',
    429: 'Çok fazla istek. Bir süre bekle.',
  };

  return send(res, 502, {
    ok: false,
    code: 'UPSTREAM_' + r.status,
    status: r.status,
    detail: govde,
    message: (ipuclari[r.status] || 'Anthropic isteği reddetti.') +
             ' [HTTP ' + r.status + (govde ? ' — ' + govde : '') + ']',
  });
}

module.exports = {
  CLIENT_ID, USAGE_URL, PROFILE_URL,
  authHeaders, bearer, send, shapeUsage, exchange, upstreamError,
};
