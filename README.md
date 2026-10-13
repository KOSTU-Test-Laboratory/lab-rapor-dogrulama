# Test Raporu Doğrulama Sistemi

Laboratuvarın PDF test raporlarının gerçekliğini müşterinin doğrulayabilmesi için web sistemi. Admin PDF yükler; sistem belgeye imzalı seri no ve QR üretir. Müşteri basılı rapordaki QR'ı okutunca belgenin geçerlilik durumunu ve özet ürün bilgilerini görür; orijinal PDF'e parolasız erişebilir (QR veya rapor seri no'su yeterlidir).

## Akış
1. Admin `/admin` panelinde giriş yapar; QR'sız/seri no'suz PDF'i ve belge bilgilerini formla yükler.
2. Sistem seri no (`KTLAB-YYYY-XXXXXXXXXX-CCCC`) ve QR (PNG) üretir.
3. Admin seri no ve QR'ı müşteriye verilecek yeni PDF'e kendisi yerleştirir.
4. Müşteri QR'ı okutur (`/v/<token>`) veya seri no'yu girer → Geçerli/Geçersiz + özet bilgiler → orijinal PDF'i parolasız görüntüler/indirir.

## Özellikler
- Durumlar: Geçerli / Geçersiz + neden (silindi, yeni sürümle değiştirildi [güncel seri no], yönetici iptali, bilinmeyen/sahte QR). Süre sınırı yok.
- Müşteri sayfası: ürün adı, marka/model, tür, kısa özet, test tarihi, test sorumlusu; müşteri adı ve ürün seri no maskeli.
- PDF erişimi parolasızdır: QR'a veya rapor seri no'suna sahip olan herkes orijinal PDF'i görüntüleyip indirebilir.
- Tek admin hesabı; yeni sürüm yükleme, iptal, silme; QR indirme.
- Yalnızca Türkçe arayüz, KVKK bilgilendirme bölümü, logoya uygun yeşil-beyaz hareketli tasarım.

## Dosyalar
| Dosya | Görev |
|---|---|
| `server.js` | Tüm backend (API, kimlik doğrulama, kriptografi, veritabanı) |
| `public/` | `index.html`/`app.js` müşteri sayfası; `admin.html`/`admin.js` yönetim; `style.css`; `logo.png` |
| `Dockerfile`, `docker-compose.yml` | Uygulama konteyneri, kalıcı veri volume'ü (`dbdata`) |
| `docker-compose.prod.yml`, `Caddyfile` | Sunucuda otomatik HTTPS (Caddy) |
| `.env.example` | Ayar şablonu |
| `KURULUM.md` | Fiziksel sunucu kurulum rehberi |

## Güvenlik katmanları
- **Seri no:** 10 rastgele karakter + HMAC kontrol kodu. **QR:** 128 bit rastgele değer + HMAC imzası; sahte kodlar veritabanına bakılmadan reddedilir. Anahtarlar `QR_SECRET`'tan HKDF ile ayrı türetilir.
- **Kurum imzası:** Her belge Ed25519 ile imzalanır (seri no + PDF SHA-256). Açık anahtar: `/.well-known/kurum-imza.pem`. İndirmede dosya çözülüp hash ve imza yeniden doğrulanır.
- **Depolama:** PDF'ler diskte AES-256-GCM ile şifreli saklanır (sunucu sunarken çözer, hash ve imzayı doğrular).
- **Oturum:** HS256 sabit, sunucuda iptal edilebilir JWT; `httpOnly` + `SameSite=Strict` çerez (HTTPS'te `__Host-`); yazma isteklerinde Origin + özel başlık kontrolü.
- **Sınırlar:** Giriş IP başına 5 hatalı deneme/15 dk; sorgular 30/dk; indirme IP başına 10/dk.
- **Denetim:** Audit log hash zinciriyle bağlıdır; `GET /api/admin/audit` kurcalamayı (`chain_ok`) gösterir.
- **Diğer:** Sıkı CSP, referrer yok, `/api` önbelleksiz, girdi temizliği, güvensiz ayarla sunucu başlamaz; konteyner salt okunur, yetkisiz, yalnızca `127.0.0.1`'e bağlı.

## Veri modeli (SQLite, `DATA_DIR`)
`docs` (seri no, token, ürün alanları, müşteri adı, durum/neden, PDF SHA-256, imza), `audit` (zincirli kayıt). PDF'ler `pdfs/`, imza anahtarları `keys/` altında.

## API
**Herkese açık:** `GET /api/verify/:token` · `GET /api/lookup?serial=` · `GET /api/download?token=` veya `?serial=` · `GET /api/public-key` · `GET /.well-known/kurum-imza.pem` · `GET /health`
**Admin:** `POST /api/login` · `POST /api/logout` · `GET|POST /api/admin/docs` · `POST /api/admin/docs/:id/replace|invalidate` · `DELETE /api/admin/docs/:id` · `GET /api/admin/docs/:id/qr.png` · `GET /api/admin/audit`

## Ayarlar (`.env`)
| Değişken | Açıklama |
|---|---|
| `ADMIN_PASSWORD` | Admin parolası (en az 12 karakter) |
| `JWT_SECRET` | Oturum imzası (en az 32 karakter) |
| `QR_SECRET` | Seri no/QR/dosya/imza anahtarlarının kaynağı (en az 32, JWT'den farklı). **Asla değiştirmeyin, yedekleyin** |
| `BASE_URL` | QR'a gömülen adres (`https://...`) |
| `COOKIE_SECURE` | HTTPS'te `1`, yerelde `0` |
| `TRUST_PROXY` | Ters vekil arkasında `1`, doğrudan erişimde `0` |
| `BIND` | Uygulamanın bağlandığı adres (varsayılan `127.0.0.1`) |
| `DOMAIN`, `COMPOSE_FILE` | Yalnızca sunucu/HTTPS kurulumunda (bkz. `.env.example`) |

## Çalıştırma
**Yerel test:** `.env.example` → `.env` (zorunlu değerleri doldurun; yerel değerler dosyadaki "Yerel test" bölümünde), `docker compose up -d --build`, `http://localhost:3000/admin`.
**Kurumsal sunucu:** `KURULUM.md`.

## Yedekleme ve anahtarlar
Geri dönüş için **iki şey birlikte** yedeklenmelidir: `dbdata` volume'ü (veritabanı, şifreli PDF'ler, imza anahtarı) ve `.env` (özellikle `QR_SECRET`). Biri kaybolursa mevcut QR'lar, imzalar ve PDF'ler çözülemez. Ayrıntı: `KURULUM.md`. `docker compose down -v` tüm veriyi siler.

## Sınırlar ve planlananlar
- İmza ayrık (detached) Ed25519'dur; Adobe'de görünen gömülü imza (PAdES) için kurumsal sertifika gerekir.
- Admin arayüzünde "Çıkış" düğmesi ve audit log görüntüleme ekranı yok (uç noktalar hazır).
- PDF erişiminde parola yok: QR'a veya seri no'ya sahip herkes orijinal PDF'e ulaşır (bilinçli tercih). Erişim yalnızca IP başına hız sınırı ve audit logla izlenir.
- 2FA yok; KVKK aydınlatma tam metni kuruma ait yer tutucu.
- Sistem Docker'da çalıştırılarak uçtan uca test edilmemiştir; kurulumdan sonra `KURULUM.md` §8 testleri yapılmalıdır.
