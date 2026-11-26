# Test Raporu Doğrulama Sistemi

Laboratuvarın PDF test raporlarının gerçekliğini müşterinin doğrulayabilmesi için iki ayrı web uygulaması. QR üretici QR'sız PDF'ten kalıcı dosya tutmadan QR üretir. QR rapora elle eklendikten sonra yalnızca son PDF doğrulama sistemine yüklenir; sistem seri numarasını son PDF'in SHA-256 hash'inden üretir. Müşteri QR'ı veya seri numarasını kullanarak belgeyi doğrular ve geçerli belgenin PDF'ini parola olmadan görüntüleyip indirebilir. Seri no/QR'ı bilen herkes PDF'e erişebileceğinden rapor dağıtımında bu dikkate alınmalıdır.

## Akış
1. Admin `/qr/` QR üreticiye girer, QR'sız PDF'i yükler ve bir QR ile token alır. QR tokenı aynı kaynak PDF için sabittir; QR üretici PDF'i kaydetmez.
2. Admin QR'ı rapora elle ekler; seri numarası PDF'e yazılmaz.
3. Admin son PDF'i ve QR üreticinin verdiği tokenı `/admin` doğrulama paneline yükler.
4. Doğrulama sistemi son PDF'in SHA-256 özetinin ilk 32 hex karakterinden (`KTLAB-` önekiyle) seri numarası üretir; tam SHA-256 özetini içeride saklar ve imzalar. Eski tam uzunluktaki seri numaraları da doğrulanır; kısa seri no çakışması kaydı reddettirir.
5. Müşteri QR'ı okutur (`/v/<token>`) veya seri numarasını girer → geçerlilik ve özet bilgiler → geçerli PDF'e parola olmadan erişim.

## Özellikler
- Durumlar: Geçerli / Geçersiz + neden (silindi, yeni sürümle değiştirildi [güncel seri no], yönetici iptali, bilinmeyen/sahte QR). Süre sınırı yok.
- Müşteri sayfası: ürün adı, marka/model, tür, kısa özet, test tarihi, test sorumlusu; müşteri adı ve ürün seri no maskeli.
- Geçerli belgenin PDF'i herkese açık QR veya seri no bağlantısıyla indirilir; müşteri hesabı/parolası gerekmez.
- Aynı QR tokenı veya aynı son PDF hash'i ikinci kez kaydedilemez.
- Tek admin hesabı; QR üretimi ayrı uygulamada, belge yükleme/yeni sürüm/iptal/silme doğrulama panelinde.
- Admin belge listesi: genel arama, müşteri/tür/durum/test tarihi filtreleri, sütun başlığından sıralama ve sayfalama (sunucu tarafı). Aynı model + ürün seri no için geçerli belge varken ikincisi reddedilir ("Yeni sürüm" kullanılır).
- Yalnızca Türkçe arayüz, KVKK bilgilendirme bölümü, logoya uygun yeşil-beyaz hareketli tasarım.

## Dosyalar
| Dosya | Görev |
|---|---|
| `server.js` | Doğrulama backend'i (API, kimlik doğrulama, kriptografi, veritabanı) |
| `qr-generator/` | PDF'i kalıcı saklamadan QR üreten bağımsız uygulama |
| `public/` | `index.html`/`app.js` müşteri sayfası; `admin.html`/`admin.js` yönetim; `style.css`; `logo.png` |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Doğrulama ve QR servisleri; kalıcı veri volume'ü (`dbdata`), build bağlamından sır/veri hariç |
| `docker-compose.local.yml` | Yerel testte app ve QR servislerini host'un 3100/3101 portlarında yayımlar |
| `docker-compose.prod.yml`, `Caddyfile` | Sunucuda otomatik HTTPS (Caddy) |
| `.env.example` | Ayar şablonu |
| `KURULUM.md` | Fiziksel sunucu kurulum rehberi |
| `DEVELOPER_DESIGN.md` | Mimari, akışlar, API'ler, güvenlik kararları ve geliştirici komutları |

## Güvenlik katmanları
- **Seri no:** Yeni belgelerde son PDF SHA-256 özetinin ilk 32 hex karakteri; tam özet saklanır ve imzalanır. Eski tam uzunluktaki ve legacy seri numaraları doğrulanmaya devam eder. Kısa seri no çakışması kaydı reddettirir. **QR tokenı:** Kaynak PDF hash'inin `QR_ID_SECRET` ile HMAC'i; aynı kaynak PDF için aynı QR oluşur. Verifier yeni tokenı yalnızca admin yükleme sırasında kayda bağlandıktan sonra kabul eder.
- **İmza ve bütünlük:** Her belge Ed25519 ile imzalanır (seri no + tam PDF SHA-256); indirmede dosya hash'i ve imza sunucu tarafında yeniden doğrulanır. Bu, sistem içi detached imzadır; PAdES/kurumsal sertifika değildir ve sunucudan alınan açık anahtar tek başına bağımsız güven zinciri sağlamaz. Açık anahtar: `/.well-known/kurum-imza.pem`.
- **Depolama:** PDF'ler AES-256-GCM ile şifreli saklanır; indirmede çözülüp SHA-256 özeti ve Ed25519 imzası doğrulanır. Yönetici parolası bcrypt ile saklanır.
- **Oturum:** HS256 sabit, sunucuda iptal edilebilir JWT; `httpOnly` + `SameSite=Strict` çerez (HTTPS'te `__Host-`); yazma isteklerinde Origin + özel başlık kontrolü.
- **Sınırlar:** Giriş IP başına 5 hatalı deneme/15 dk; doğrulama sorguları IP başına 30/dk; PDF indirmeleri IP başına 10/dk ile sınırlıdır.
- **Denetim:** Audit log hash zinciriyle bağlıdır; `GET /api/admin/audit` kurcalamayı (`chain_ok`) gösterir. Sorgu logları IP içerir ve şu anda otomatik saklama/silme süresi tanımlı değildir; kurum politikası belirlenmeden üretimde bu logların süresiz tutulması gözden geçirilmelidir.
- **Diğer:** Sıkı CSP, referrer yok, `/api` önbelleksiz, girdi temizliği, güvensiz ayarla sunucu başlamaz; konteynerler salt okunur ve yetkisiz çalışır. Üretimde yalnızca Caddy'nin 80/443 portları host'a açılır; app ve QR servislerine Docker ağı içinden erişilir. Yerel Compose dosyası 3100/3101 portlarını host arayüzlerinde yayımlar; LAN erişiminde firewall ile sınırlandırın.

## Veri modeli (SQLite, `DATA_DIR`)
`docs` (seri no, QR tokenı, ürün alanları, müşteri adı, durum/neden, son PDF'in SHA-256 hash'i ve imza), `audit` (zincirli kayıt). Müşteri adı belge bilgisidir; müşteri hesabı/parolası yoktur. QR üretici PDF'i kalıcı saklamaz. Doğrulama sistemindeki PDF'ler `pdfs/`, imza anahtarları `keys/` altında.

## API
**Herkese açık:** `GET /api/verify/:token` · `GET /api/lookup?serial=` · `GET /api/download?token=<token>` veya `GET /api/download?serial=<serial>` · `GET /api/public-key` · `GET /.well-known/kurum-imza.pem` · `GET /health`
**QR üretici (`/qr/`):** `POST /qr/api/login` · `POST /qr/api/qr` (PDF yükle, QR ve token al) · `POST /qr/api/logout`
**Doğrulama admin'i:** `POST /api/login` · `POST /api/logout` · `GET|POST /api/admin/docs` (`POST` yüklemesinde `qr_token` gerekir) · `POST /api/admin/docs/:id/replace|invalidate` · `DELETE /api/admin/docs/:id` · `GET /api/admin/audit`

## Ayarlar (`.env`)
| Değişken | Açıklama |
|---|---|
| `ADMIN_PASSWORD` | Admin parolası (en az 12 karakter) |
| `JWT_SECRET` | Oturum imzası (en az 32 karakter) |
| `QR_SECRET` | Eski seri no/QR'lar, dosya şifreleme ve imza anahtarlarının kaynağı (en az 32, JWT'den farklı). **Asla değiştirmeyin, yedekleyin** |
| `QR_ID_SECRET` | QR üreticinin kaynak PDF hash'inden sabit token üretme anahtarı (en az 32 karakter); değişirse aynı kaynak PDF yeni token üretir |
| `BASE_URL` | QR'a gömülen adres (`https://...`) |
| `COOKIE_SECURE` | HTTPS'te `1`, yerelde `0` |
| `TRUST_PROXY` | Ters vekil arkasında `1`, doğrudan erişimde `0` |
| `DOMAIN`, `COMPOSE_FILE` | Üretim alan adı ve üretim Compose dosyalarının seçimi (bkz. `KURULUM.md`) |

## Ağ ve çalıştırma
- **Üretim:** Tek alan adı kullanılır. Caddy dışarıya yalnızca 80/443 portlarını açar; doğrulama servisi `app:3000`, QR servisi `qr:3001` Docker'ın iç ağında kalır. Müşteri sayfası `/`, admin `/admin`, QR üretici `/qr/` yolundadır. Bu nedenle 3000/3001 portlarının üretim sunucusunda boşta olması veya internete açılması gerekmez.
- **Yerel test:** Yeni ortamda `.env.example` dosyasını `.env` olarak kopyalayın; mevcut `.env` dosyasını asla ezmeyin. `CHANGE_ME`/`GENERATE_*` değerlerini değiştirin ve anahtarları ayrı ayrı `openssl rand -hex 32` ile üretin. Sonra `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` çalıştırın. QR üretici `http://localhost:3101`, doğrulama paneli `http://localhost:3100/admin` adresindedir. Diğer cihazlardan erişmek için `BASE_URL`'i erişilebilir host IP'sine ve `:3100` portuna ayarlayın; yalnızca güvenilir ağda kullanın.
- **Kurumsal sunucu:** `KURULUM.md` içindeki üretim ayarlarını kullanın; `.env` içindeki `COMPOSE_FILE` Caddy'li yapılandırmayı seçer.

## Yedekleme ve anahtarlar
Geri dönüş için **iki şey birlikte** yedeklenmelidir: `dbdata` volume'ü (veritabanı, şifreli son PDF'ler, imza anahtarı) ve `.env` (özellikle `QR_SECRET` ve `QR_ID_SECRET`). `QR_SECRET` kaybolursa mevcut imzalar ve PDF'ler çözülemez. `QR_ID_SECRET` kaybolursa mevcut kayıtlar çalışır ancak kaynak PDF'lerden aynı QR tokenları tekrar üretilemez. Ayrıntı: `KURULUM.md`. `docker compose down -v` tüm veriyi siler.

## Sınırlar ve planlananlar
- İmza ayrık (detached) Ed25519'dur; Adobe'de görünen gömülü imza (PAdES) için kurumsal sertifika gerekir.
- Admin arayüzünde audit log görüntüleme ekranı yok (uç nokta hazır); 2FA yok.
- Ana sayfadaki gizlilik bildirimi genel metindir; kurumun veri sorumlusu/iletişim ve saklama politikasıyla gözden geçirilmelidir.
- Sistem Docker'da çalıştırılarak uçtan uca test edilmemiştir; kurulumdan sonra `KURULUM.md` §8 testleri yapılmalıdır.
