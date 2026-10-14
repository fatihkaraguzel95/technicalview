# Claude Limit — web sürümü

Claude hesabının kalan limitini gösteren siyah panel. Vercel üzerinde çalışır:
**bilgisayarın kapalı olabilir**, telefon mobil veride olabilir, panel yine çalışır.

İlk açılışta Claude hesabınla giriş yaparsın. **Hangi hesapla girilirse o hesabın
verileri** gösterilir.

Panelde:

- **Oturum limiti (5 saatlik)** — kalan yüzde, büyük halka + yenilenme geri sayımı
- **Haftalık limit** — kalan yüzde + yenilenme zamanı
- **Haftalık kullanım dağılımı** — Claude Code / Chats / Cowork payları
- **Gece modu** — belirlediğin saatlerde ekran kararır, sabah kendiliğinden geri gelir

> Claude Pro'da "günlük" diye bir limit yok. Gerçek limitler **5 saatlik oturum penceresi**
> ve **7 günlük haftalık** limit.

---

## Mimari — token nerede duruyor?

```
Tarayıcı                     Vercel                      Anthropic
--------                     ------                      ---------
token burada durur  ──►  /api/usage (iletir)   ──►  api.anthropic.com
                         hiçbir şey saklamaz
```

Sunucu tarafı tamamen **durumsuz**: veritabanı yok, oturum yok, token kaydı yok.
Token senin tarayıcının `localStorage`'ında durur ve her istekte `Authorization`
başlığıyla gelir. Vercel fonksiyonu onu Anthropic'e iletir, sonucu döndürür ve unutur.

Bunun pratik sonucu: **senin anahtarını kimse taşımıyor.** Panelin açık olması
hesabına erişim vermez; tarayıcı verisini silmek çıkış yapmaya eşdeğerdir.

## Kurulum

### 1. Vercel'e bağla

1. [vercel.com](https://vercel.com) → GitHub hesabınla giriş yap
2. **Add New → Project** → bu depoyu seç
3. **Root Directory**'yi `claude-limit-web` olarak ayarla (önemli — depoda başka
   klasörler de var)
4. Deploy

Build ayarı gerekmez; `public/` statik olarak servis edilir, `api/*.js` dosyaları
sunucusuz fonksiyon olur.

### 2. Telefona kur

1. Çıkan adresi (`https://....vercel.app`) Chrome'da aç
2. **Claude ile giriş yap** → Claude'un onay sayfasında izin ver → çıkan kodu kopyala
3. Kodu panele yapıştır
4. Menü (⋮) → **Ana ekrana ekle**

HTTPS olduğu için uygulama tam ekran açılır ve sayfa ekranı açık tutabilir.

Başka bir cihaz eklemek için aynı adımlar — her cihaz kendi oturumunu tutar.

### 3. Ekranı sürekli açık tutma

Panel HTTPS üzerinden çalıştığı için ekranı kendisi açık tutmaya çalışır (Wake Lock).
Daha sağlam yöntem, telefon ayarından:

**Ayarlar → Telefon hakkında** → "Derleme numarası"na 7 kez dokun →
**Ayarlar → Sistem → Geliştirici seçenekleri → "Şarj olurken ekran açık kalsın"** aç.

## Gece modu

Alttaki **Ayarlar** düğmesinden (varsayılan: 00:00 – 09:00).

- Belirlenen saatlerde sayfa tamamen siyah olur. OLED ekranda siyah piksel kapalı piksel
  demektir; ekran kapalıymış gibi görünür, neredeyse hiç pil harcamaz ve sabah
  **kendiliğinden** geri gelir.
- Perdeye dokununca panel 15 saniye görünür.
- Gece veri çekme sıklığı 30 saniyeden 5 dakikaya düşer.
- **"Gece ekran tamamen uyusun"** ekranı gerçekten kapatır — ama bir web sayfası uyuyan
  ekranı açamaz, sabah bir kez dokunman gerekir. Ayrıca bunun çalışması için yukarıdaki
  "şarj olurken açık kalsın" ayarının **kapalı** olması gerekir.

Panel ayrıca içeriği dakikada birkaç piksel kaydırır — saatlerce sabit duran halkanın
OLED ekranda iz bırakmasını önlemek için.

## Bilinmesi gerekenler

- **Giriş, Claude Code'un OAuth istemcisini kullanıyor.** Anthropic üçüncü taraf
  uygulamalar için açık bir "Claude ile giriş yap" hizmeti sunmuyor; başka yolu yok.
  Resmî olarak desteklenen bir kullanım değil, Anthropic istediği an kapatabilir.
- **Bu panelden giriş yapmak, bilgisayarındaki Claude Code oturumunu etkileyebilir.**
  Normalde her giriş bağımsız bir oturum açar, ama garanti edemem. Etkilenirse çözüm
  basit: bilgisayarda `claude` çalıştırıp `/login` ile tekrar gir.
- **Token yalnızca "limitimi oku" yetkisiyle sınırlı değil.** Hesap adına Claude'a istek
  atma yetkisi de içeriyor. Kendi kullanımın için sorun değil; bu yüzden adresi
  başkalarına dağıtma.
- Giriş kodunun ömrü kısadır. Kopyalayıp hemen yapıştır, gecikirse yeni kod al.

## Yerel geliştirme

```
node dev-server.js        # http://localhost:3000
```

Vercel'in `/api/*.js` fonksiyonlarını çalıştırma biçimini taklit eder; deploy etmeden
değişiklik denemek için. Yayında kullanılmaz.

## Dosyalar

| Dosya | İş |
|---|---|
| `public/index.html` | Giriş ekranı + panel (arayüz ve mantığın tamamı) |
| `api/usage.js` | Kullanım yüzdeleri |
| `api/me.js` | Giriş yapan hesabın adı/planı |
| `api/token.js` | Giriş kodunu token'a çevirir |
| `api/refresh.js` | Süresi dolan token'ı yeniler |
| `api/_anthropic.js` | Ortak yardımcılar (alt çizgi ile başladığı için rota değil) |
| `dev-server.js` | Yerel test sunucusu |
| `vercel.json` | `public/` statik, `api/` fonksiyon |

## Bilgisayar tabanlı sürüm

Buluta hiç çıkmak istemiyorsan `../claude-usage-monitor` klasöründeki sürüm aynı paneli
ev ağında, PC üzerinden servis eder. Giriş gerektirmez ama PC'nin açık olmasını ister.
