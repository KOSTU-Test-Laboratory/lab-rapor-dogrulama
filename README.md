# Test Raporu Doğrulama Sistemi

Laboratuvarın PDF test raporlarının gerçekliğini müşterinin doğrulayabilmesi için web sistemi. Admin PDF yükler; sistem belgeye imzalı seri no ve QR üretir. Müşteri basılı rapordaki QR'ı okutunca belgenin geçerlilik durumunu ve özet ürün bilgilerini görür; geçerli belgenin orijinal PDF'ini QR veya seri no ile parola olmadan görüntüleyip indirebilir. Seri no ve QR'ı bilen herkes PDF'e erişebileceğinden rapor dağıtımında bu dikkate alınmalıdır.

## Akış
1. Admin `/admin` panelinde giriş yapar; QR'sız/seri no'suz PDF'i ve belge bilgilerini formla yükler.
2. Sistem seri no (`KTLAB-YYYY-XXXXXXXXXX-CCCC`) ve QR (PNG) üretir.
3. Admin seri no ve QR'ı müşteriye verilecek yeni PDF'e kendisi yerleştirir.
4. Müşteri QR'ı okutur (`/v/<token>`) veya seri no'yu girer → Geçerli/Geçersiz + özet bilgiler → geçerli belgenin orijinal PDF'ini parolasız görüntüler/indirir.

## Özellikler
- Durumlar: Geçerli / Geçersiz + neden (silindi, yeni sürümle değiştirildi [güncel seri no], yönetici iptali, bilinmeyen/sahte QR). Süre sınırı yok.
- Müşteri sayfası: ürün adı, marka/model, tür, kısa özet, test tarihi, test sorumlusu; müşteri adı ve ürün seri no maskeli.
- Geçerli belgenin PDF'i herkese açık QR veya seri no bağlantısıyla indirilir; müşteri hesabı/parolası gerekmez.
- Tek admin hesabı; yeni sürüm yükleme, iptal, silme; QR indirme.
- Admin belge listesi: genel arama, gönderim no/müşteri/tür/durum/test tarihi filtreleri, sütun başlığından sıralama ve sayfalama (sunucu tarafı). Her belgede yalnızca admin panelinde görünen **gönderim no** alanı vardır. Aynı model + ürün seri no için geçerli belge varken ikincisi reddedilir ("Yeni sürüm" kullanılır).
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
- **Depolama:** PDF'ler AES-256-GCM ile şifreli saklanır; indirmede çözülüp SHA-256 özeti ve Ed25519 imzası doğrulanır. Yönetici parolası bcrypt ile saklanır.
- **Oturum:** HS256 sabit, sunucuda iptal edilebilir JWT; `httpOnly` + `SameSite=Strict` çerez (HTTPS'te `__Host-`); yazma isteklerinde Origin + özel başlık kontrolü.
- **Sınırlar:** Giriş IP başına 5 hatalı deneme/15 dk; doğrulama sorguları IP başına 30/dk; PDF indirmeleri IP başına 10/dk ile sınırlıdır.
- **Denetim:** Audit log hash zinciriyle bağlıdır; `GET /api/admin/audit` kurcalamayı (`chain_ok`) gösterir.
- **Diğer:** Sıkı CSP, referrer yok, `/api` önbelleksiz, girdi temizliği, güvensiz ayarla sunucu başlamaz; konteyner salt okunur, yetkisiz, yalnızca `127.0.0.1`'e bağlı.

## Veri modeli (SQLite, `DATA_DIR`)
`docs` (seri no, token, ürün alanları, müşteri adı, durum/neden, PDF SHA-256 ve imza), `audit` (zincirli kayıt). Müşteri adı belge bilgisidir; müşteri hesabı veya müşteri parola tablosu kullanılmaz. PDF'ler `pdfs/`, imza anahtarları `keys/` altında.

## API
**Herkese açık:** `GET /api/verify/:token` · `GET /api/lookup?serial=` · `GET /api/download?token=<token>` veya `GET /api/download?serial=<serial>` · `GET /api/public-key` · `GET /.well-known/kurum-imza.pem` · `GET /health`
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
**Yerel test:** `.env.example` → `.env` (zorunlu değerleri doldurun), `docker compose up -d --build`, `http://localhost:3000/admin`.
**Kurumsal sunucu:** `KURULUM.md`.

## Yedekleme ve anahtarlar
Geri dönüş için **iki şey birlikte** yedeklenmelidir: `dbdata` volume'ü (veritabanı, şifreli PDF'ler, imza anahtarı) ve `.env` (özellikle `QR_SECRET`). Biri kaybolursa mevcut QR'lar, imzalar ve PDF'ler çözülemez. Ayrıntı: `KURULUM.md`. `docker compose down -v` tüm veriyi siler.

## Sınırlar ve planlananlar
- İmza ayrık (detached) Ed25519'dur; Adobe'de görünen gömülü imza (PAdES) için kurumsal sertifika gerekir.
- Admin arayüzünde "Çıkış" düğmesi ve audit log görüntüleme ekranı yok (uç noktalar hazır).
- 2FA yok; KVKK aydınlatma tam metni kuruma ait yer tutucu.
- Sistem Docker'da çalıştırılarak uçtan uca test edilmemiştir; kurulumdan sonra `KURULUM.md` §8 testleri yapılmalıdır.
