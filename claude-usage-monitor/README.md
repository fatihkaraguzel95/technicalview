# Claude Limit Monitor

Claude hesabının kalan limitini siyah, tam ekran bir panelde gösterir. Küçük bir sunucu
Claude kimlik bilgisini okur ve kullanım yüzdelerini servis eder; telefon bu paneli açar
ve **30 saniyede bir** kendini yeniler.

Panelde:

- **Oturum limiti (5 saatlik)** — kalan yüzde, büyük halka + yenilenme geri sayımı
- **Haftalık limit** — kalan yüzde + yenilenme zamanı
- **Haftalık kullanım dağılımı** — Claude Code / Chats / Cowork payları
- **Gece modu** — belirlediğin saatlerde ekran kararır, sabah kendiliğinden geri gelir

> **Not:** Claude Pro'da "günlük" diye bir limit yok. Gerçek limitler **5 saatlik oturum
> penceresi** ve **7 günlük haftalık** limit. Panel de bu ikisini gösteriyor.

---

## Nasıl çalışıyor

```
Telefon (tarayıcı)  ──►  sunucu  ──►  api.anthropic.com/api/oauth/usage
   siyah panel          token okur,        kalan limit yüzdeleri
   30 sn'de bir         20 sn önbellek
```

Kritik nokta: **kimlik bilgisi tek bir yerde durur, cihazlarda durmaz.**
Telefon, tablet, ikinci bilgisayar — hepsi sadece adresi açar. Hiçbirinde Claude'a giriş
yapmaz, token hiçbirine gitmez; yalnızca yüzdeler gider. Bu yüzden yeni bir cihaza
"kurmak" diye bir şey yok: adresi açıp ana ekrana eklemek yeterli.

Şu an sunucu **PC'de** çalışıyor (bu klasördeki `server.js`), dolayısıyla PC açık olmalı.
PC kapalıyken de çalışması için sunucunun buluta taşınması gerekir — bkz. *Yol haritası*.

---

## 1. PC'de çalıştır

`baslat.bat` dosyasına çift tıkla. Açılan pencerede telefondan girilecek adres yazar:

```
Telefon : http://192.168.178.27:7373   (WLAN)
```

Bu pencere **açık kalmalı**.

## 2. Güvenlik duvarı — bir kez

Telefon bağlanamıyorsa Windows gelen bağlantıyı engelliyordur.
**Yönetici olarak** PowerShell açıp:

```powershell
New-NetFirewallRule -DisplayName "Claude Usage Monitor 7373" `
  -Direction Inbound -Protocol TCP -LocalPort 7373 `
  -Action Allow -RemoteAddress LocalSubnet
```

`-RemoteAddress LocalSubnet` sayesinde panel yalnızca ev ağından açılabilir.
Kaldırmak için: `Remove-NetFirewallRule -DisplayName "Claude Usage Monitor 7373"`

## 3. Telefona kur

1. Chrome'da adresi aç
2. Menü (⋮) → **Ana ekrana ekle**
3. Ana ekranda Claude ikonuyla duran bir uygulama olur

Başka cihazlar için de aynı üç adım — her cihazda ayrıca giriş yapman gerekmez.

## 4. Ekranı sürekli açık tutma

**Ayarlar → Telefon hakkında** → "Derleme numarası"na 7 kez dokun →
**Ayarlar → Sistem → Geliştirici seçenekleri → "Şarj olurken ekran açık kalsın"** aç.

Telefon şarjdayken ekran hiç kapanmaz. Yedek olarak ekran zaman aşımını en uzun değere al.

Panel HTTPS üzerinden servis edilirse (bulut kurulumu) sayfa ekranı kendisi de açık
tutabilir — tarayıcı Wake Lock iznini yalnızca HTTPS'te veriyor. Yerel `http://` adreste
bu özellik sessizce devre dışı kalır, telefon ayarı yine de çalışır.

## 5. Gece modu

Panelin altındaki **Gece modu** düğmesinden ayarlanır (varsayılan: 00:00 – 09:00).

- Belirlenen saatlerde sayfa **tamamen siyah** olur. OLED ekranda siyah piksel kapalı
  piksel demektir; ekran kapalıymış gibi görünür ve neredeyse hiç pil harcamaz.
  Ekran teknik olarak açık kaldığı için sabah **kendiliğinden** geri gelir.
- Perdeye dokununca panel 15 saniye görünür.
- Gece veri çekme sıklığı 30 saniyeden 5 dakikaya düşer.
- **"Gece ekran tamamen uyusun"** seçeneği ekranı gerçekten kapatır — ama bir web sayfası
  uyuyan ekranı açamaz, sabah ekrana bir kez dokunman gerekir. Ayrıca bu seçeneğin
  çalışması için yukarıdaki "şarj olurken açık kalsın" ayarının **kapalı** olması gerekir.

Ayarlar tarayıcıda saklanır, her cihaz kendi gece saatini tutar.

Panel ayrıca içeriği dakikada birkaç piksel kaydırır (gözle fark edilmez) — saatlerce
sabit duran halka ve yazıların OLED ekranda iz bırakmasını önlemek için.

## 6. (İsteğe bağlı) PC açılışında otomatik başlat

`Win + R` → `shell:startup` → açılan klasöre `gizli-baslat.vbs` dosyasının
**kısayolunu** koy. Sunucu konsol penceresi açmadan arka planda başlar.

---

## Güvenlik

- Token, Claude Code'un zaten kullandığı `~/.claude/.credentials.json` dosyasından okunur
  ve **sunucudan dışarı çıkmaz**. Panele yalnızca yüzdeler gider.
- Sunucu token'ı **yenilemez**. Yenilemeyi Claude Code yapar; biz sadece okuruz. Böylece
  Claude Code oturumunun bozulma riski yok.
- Token süresi dolarsa panel kırmızı bir uyarı gösterir — PC'de Claude Code'u bir kez
  çalıştırmak token'ı tazeler, panel kendiliğinden düzelir.
- Kaç cihaz açık olursa olsun Anthropic'e 20 saniyede birden sık istek gitmez.
- Bu depoda hiçbir token/anahtar yoktur ve olmamalıdır.

## Yol haritası — PC kapalıyken çalışması

Sunucuyu her an açık bir yere taşımak gerekiyor. Planlanan:

1. `claude setup-token` ile **ayrı ve uzun ömürlü** bir token üret (PC'deki Claude Code
   oturumunu etkilemez).
2. Bu token'ı Cloudflare Workers / Vercel üzerinde şifreli bir secret olarak sakla.
3. `server.js`'in yaptığı işi orada çalıştır; panel aynen kalır.

Sonuç: kalıcı bir `https://...` adresi — PC kapalı, evde değilsin, mobil veridesin fark
etmez. HTTPS olduğu için telefona gerçek uygulama gibi kurulur ve Wake Lock devreye girer.
Adrese bir gizli anahtar eklenmeli, yoksa adresi bilen herkes kullanım yüzdelerini görür.

## Dosyalar

| Dosya | İş |
|---|---|
| `server.js` | Token okur, kullanım verisini çeker, paneli servis eder |
| `public/index.html` | Panelin tamamı (arayüz + mantık + gece modu) |
| `public/manifest.webmanifest`, `public/sw.js` | Ana ekrana eklenince uygulama gibi açılması |
| `public/icon-*.png` | Siyah zeminde Claude işareti |
| `make_icons.py` | İkonları yeniden üretmek için |
| `baslat.bat` / `gizli-baslat.vbs` | Başlatıcılar |

## Ayarlar

- **Port:** `set PORT=8080 && node server.js`
- **Yenileme sıklığı:** `public/index.html` içinde `POLL_DAY` / `POLL_NIGHT`
- **Sunucu önbelleği:** `server.js` içinde `CACHE_MS`

## Gereksinimler

- Node.js 18+
- PC açık ve sunucu çalışıyor olmalı (bulut kurulumuna kadar)
- Cihaz ile PC aynı Wi-Fi ağında olmalı
- PC'de VPN açıksa yerel ağ erişimini kesebilir — bağlanamazsan önce onu kapat
