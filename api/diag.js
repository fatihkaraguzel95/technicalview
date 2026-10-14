/**
 * Teşhis ucu — tarayıcıda /api/diag adresini açınca çalışır.
 *
 * Tek bir soruyu kesin olarak yanıtlar: sorun giriş kodunda mı, yoksa bu
 * sunucunun Anthropic'e ulaşmasında mı?
 *
 * Yöntem: kasıtlı olarak TOKENSİZ istek atılır.
 *   401 dönerse  -> Anthropic isteği alıyor, sadece kimlik yok. Engel yok.
 *   403 dönerse  -> İstek Anthropic'e varmadan reddediliyor (IP/WAF engeli).
 *
 * Hiçbir token kullanmaz, hiçbir şey saklamaz.
 */

const { USAGE_URL, send } = require('./_anthropic');

module.exports = async (req, res) => {
  const sonuc = {
    ok: true,
    bolge: process.env.VERCEL_REGION || 'yerel',
    calisma_ortami: process.env.VERCEL ? 'vercel' : 'yerel',
    zaman: new Date().toISOString(),
  };

  try {
    const r = await fetch(USAGE_URL, {
      headers: {
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-limit-web/1.0',
      },
    });

    let govde = '';
    try { govde = (await r.text()).slice(0, 200).replace(/\s+/g, ' ').trim(); } catch {}

    sonuc.anthropic_durum = r.status;
    sonuc.anthropic_yanit = govde;

    if (r.status === 401) {
      sonuc.sonuc = 'ULASILIYOR';
      sonuc.aciklama =
        'Sunucu Anthropic\'e ulaşabiliyor (tokensiz istek beklendiği gibi 401 döndü). ' +
        'Panelde 403 alıyorsan sorun giriş kodunun yetki kapsamındadır: ' +
        'o kod kullanım/profil okumaya izin vermiyor.';
    } else if (r.status === 403) {
      sonuc.sonuc = 'ENGELLENIYOR';
      sonuc.aciklama =
        'Anthropic bu sunucudan gelen isteği engelliyor (tokensiz istek 401 yerine ' +
        '403 döndü). Giriş kodunun bununla ilgisi yok; barındırma tarafını ' +
        'değiştirmek gerekir.';
    } else {
      sonuc.sonuc = 'BEKLENMEDIK';
      sonuc.aciklama =
        'Tokensiz istek ' + r.status + ' döndü; beklenen 401 idi. Yukarıdaki ' +
        'anthropic_yanit alanını bildir.';
    }
  } catch (e) {
    sonuc.ok = false;
    sonuc.sonuc = 'BAGLANTI_YOK';
    sonuc.aciklama = 'Anthropic\'e hiç bağlanılamadı: ' + String(e.message || e);
  }

  return send(res, 200, sonuc);
};
