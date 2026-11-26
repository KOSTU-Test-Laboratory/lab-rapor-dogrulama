# Geliştirici Tasarım Notları

## 1. Amaç ve kapsam

Bu proje, laboratuvar test raporlarının son PDF dosyasının değişmediğini doğrulamak ve müşteriye raporun geçerlilik durumunu göstermek için hazırlanmış iki web uygulamasıdır:

- **Doğrulama uygulaması:** Yönetici raporu ve rapor bilgilerini kaydeder. Müşteri QR kodu veya seri numarasıyla kaydı sorgular; geçerli raporun kayıtlı PDF kopyasını görüntüleyebilir veya indirebilir.
- **QR üreticisi:** QR henüz eklenmemiş kaynak PDF'i geçici olarak işler, PDF'in hash'inden sabit bir token ve bu tokenı içeren QR resmi üretir. Kaynak PDF'i kalıcı olarak saklamaz.

Bu iki adımlı tasarım, QR kodunun PDF'e elle eklenmesine izin verirken sonradan yüklenen PDF'in içeriğini doğrulama uygulamasında hash ve imzayla bağlar. QR veya seri numarasına sahip herkes doğrulama yapabilir ve geçerli PDF'i indirebilir; bu nedenle QR/seri numarası gizli erişim bilgisi değil, belgeye erişim yolu olarak değerlendirilmelidir.

## 2. Bileşenler ve teknoloji yığını

| Bileşen | Görev ve teknoloji |
|---|---|
| `server.js` | Express 4 ile doğrulama API'si ve yönetici API'si; SQLite erişimi `better-sqlite3` ile |
| `qr-generator/server.js` | Ayrı Express uygulaması; `qrcode` ile QR üretimi, dosyayı bellek içinde işler |
| `public/` | Müşteri doğrulama sayfası ve yönetim paneli; statik HTML/CSS/vanilla JavaScript |
| `qr-generator/public/` | QR üretici arayüzü; statik HTML ve vanilla JavaScript |
| `lib/identity.js` | Seri numarası, hash biçimi ve tarih doğrulama yardımcıları |
| `lib/secret-validation.js` | Kurulum şablonlarında kullanılan placeholder secret kontrolü |
| `test/` | Node.js yerleşik test koşucusuyla kimlik/tarih/secret testleri |
| `Dockerfile` | Node.js 20 tabanlı ortak imaj; her iki uygulama aynı imajdan farklı komutlarla çalışır |
| `docker-compose*.yml`, `Caddyfile` | Servis ağı, kalıcı volume, yerel portlar ve üretim HTTPS ters vekili |

Uygulama tarafında Node.js CommonJS modülleri kullanılır. Temel bağımlılıklar: Express, Helmet, express-rate-limit, Multer, bcryptjs, jsonwebtoken, better-sqlite3 ve qrcode. PDF içeriği üretmek veya PDF'e QR yerleştirmek bu uygulamanın sorumluluğunda değildir.

## 3. Üst düzey mimari

```text
Tarayıcı / telefon
       |
       +-- /, /v/:token, /admin, /api/* ------> app (Express :3000)
       |
       +-- /qr/* -----------------------------> qr (Express :3001)
                                                    |
                                                    +-- PDF bellek içinde işlenir

app -- /data volume --> SQLite, şifreli PDF'ler ve imza anahtarları
```

- Üretimde Caddy tek alan adını dinler: `/qr/*` yolunu `qr:3001` servisine, geri kalan yolları `app:3000` servisine yollar. Host'a Caddy'nin 80/443 portları açılır.
- Yerel Compose override'ı host portlarını `3100 -> app:3000` ve `3101 -> qr:3001` olarak yayımlar. QR'a gömülen bağlantı `BASE_URL`'den geldiği için LAN testinde bu değer doğrulama servisine erişilebilen adres ve portu içermelidir.
- `docker-compose.yml` uygulama servislerini `expose` eder, host portu yayımlamaz. Yerel port yayımı yalnızca `docker-compose.local.yml` ile eklenir.
- Üretim profili `.env` içindeki `COMPOSE_FILE` ile temel Compose dosyalarına eklenir. Bu değişkenin Docker Compose tarafından dosya yüklenmeden önce okunabilmesi gerekir; kurulum rehberindeki `.env` örneği bu akışı kullanır.

## 4. Temel belge akışı

### 4.1 QR üretme

1. Yönetici QR üreticiye giriş yapar.
2. QR'sız PDF, `POST /api/qr` isteğiyle yüklenir. Multer bellek deposu kullanır; sunucu dosyayı kalıcı diske yazmaz.
3. QR servisi PDF'in SHA-256 hash'ini hesaplar.
4. `QR_ID_SECRET` anahtarıyla hash üzerinden HMAC-SHA-256 hesaplar. URL güvenli base64 biçimindeki sonuç `v2.<token>` formatını alır.
5. Token, `BASE_URL` ile birleştirilerek doğrulama URL'si oluşturulur; QR PNG'si bellekte üretilip tarayıcıya döndürülür.

Aynı kaynak PDF ve aynı `QR_ID_SECRET` aynı tokenı üretir. `QR_ID_SECRET` değiştirilirse aynı PDF için yeni token çıkar; eski kayıtlı tokenlar veritabanındaki kayıtlarla eşleşmeye devam eder.

### 4.2 PDF'i kaydetme ve imzalama

1. Yönetici QR'ı kaynak PDF'e dışarıda ekler ve **son PDF'i** doğrulama paneline yükler. QR üreticinin tokenı ve rapor alanları da gönderilir.
2. Sunucu PDF başlığını ve zorunlu alanları kontrol eder; QR tokenı `v2` biçiminde olmalıdır.
3. Son PDF'in SHA-256 hash'i hesaplanır. Yeni seri numarası hash'in ilk 32 hex karakterinden `KTLAB-` önekiyle türetilir. Tam hash veritabanında saklanır.
4. Tekrar kayıtlar token, tam PDF hash'i ve seri numarası üzerinden reddedilir. Geçerli bir kaydın aynı ürün modeli ve ürün seri numarasıyla ikinci kez eklenmesi de engellenir.
5. QR tokenı veritabanındaki kayda bağlanır. QR doğrulama sırasında tek başına yeterli değildir; tokenın bir belge kaydıyla eşleşmesi gerekir.
6. PDF AES-256-GCM ile şifrelenerek `/data/pdfs/` altında saklanır. Seri numarası ve tam hash Ed25519 ile imzalanır.
7. Yeni sürüm yüklenirse işlem transaction içinde eski kaydı geçersiz kılar, yeni kaydı ekler ve eski kayda yeni seri numarasını iliştirir.

### 4.3 Müşteri doğrulaması ve indirme

- QR URL'si `/v/:token` müşteri sayfasını açar; ön yüz `GET /api/verify/:token` ile sonucu getirir.
- Alternatif olarak seri numarası `GET /api/lookup?serial=...` ile sorgulanır.
- Geçerli sonuçta müşteri adı ve ürün seri numarası maskelenir. İmza durumu ve açık anahtar parmak izi de gösterilir.
- İndirme `GET /api/download?token=...` veya `GET /api/download?serial=...` ile yapılır.
- İndirmede şifreli PDF çözülür; GCM authentication tag, SHA-256 hash ve Ed25519 imzası doğrulanmadan PDF gönderilmez.

## 5. Veri modeli ve kalıcı durum

SQLite veritabanı `/data/app.db` dosyasındadır. Şema uygulama başlarken `CREATE TABLE IF NOT EXISTS` ile oluşturulur; `sig` ve `hash` alanları için basit geriye dönük şema eklemeleri yapılır.

- **`docs`:** Seri numarası ve benzersiz QR tokenı; ürün, müşteri ve test bilgileri; PDF dosya adı ve SHA-256 hash'i; geçerlilik durumu, geçersizlik nedeni, yeni sürüm seri numarası ve Ed25519 imzası.
- **`audit`:** Zaman, IP, işlem ve detay. Her kayıt önceki hash ile bağlanan SHA-256 zincirine eklenir. Yönetici audit endpoint'i zinciri doğrular.
- **`/data/pdfs/`:** AES-GCM ile şifrelenmiş PDF dosyaları.
- **`/data/keys/signing.pem`:** QR_SECRET ile şifrelenmiş PKCS#8 Ed25519 özel anahtarı.
- **`/data/keys/public.pem`:** İmzaları doğrulamak için açık anahtar.

`dbdata` volume'u bu durumun tamamını taşır. Geri yükleme için volume ile doğru `.env` anahtarlarının birlikte korunması gerekir. QR üretici kendi başına kalıcı durum tutmaz.

## 6. Kriptografik sorumluluklar ve anahtarlar

| Ayar / anahtar | Kullanım | Değişiklik veya kayıp etkisi |
|---|---|---|
| `ADMIN_PASSWORD` | Yönetici parolası; bcrypt hash'i süreç belleğinde oluşturulur | Parola değişikliği mevcut uygulama girişini değiştirir |
| `JWT_SECRET` | İki uygulamanın HS256 oturum JWT'leri | Değişince eski oturum tokenları doğrulanamaz |
| `QR_SECRET` | HKDF-SHA-256 ile `serial`, `qr`, `file` alt anahtarları türetilir; `file` PDF AES-256-GCM şifrelemesinde, `serial` legacy seri doğrulamasında, `qr` legacy token doğrulamasında kullanılır. Ayrıca imza özel anahtarının PEM şifresidir | Kaybolması/değişmesi eski PDF'lerin çözülememesine ve mevcut imza anahtarının açılamamasına yol açar. Eski veride asla rastgele yenisiyle değiştirilmemelidir |
| `QR_ID_SECRET` | QR üreticide kaynak PDF hash'inin HMAC anahtarı | Değişirse aynı kaynak PDF yeniden üretildiğinde farklı QR tokenı çıkar |

İmza, `KTLAB-IMZA-v1|<seri>|<sha256>` içeriğinin Ed25519 imzasıdır. Bu uygulama içi detached imzadır; PDF'e gömülü PAdES imzası veya kurum dışı güven zinciri değildir. Sunucudan alınan açık anahtarın bağımsız güvenilirliği ayrıca dağıtılmadıkça sunucuya olan güvene bağlıdır.

İmza anahtarı ilk çalıştırmada üretilir. Volume'daki `signing.pem` mevcutsa `QR_SECRET` ile açılır; yanlış secret Node.js'in `ERR_OSSL_BAD_DECRYPT` hatasıyla başlangıcı durdurur. Volume silip yeni secret ile başlamak tüm yerel kayıtları, PDF'leri ve imza anahtarını kaybettirir; eski QR/seri numaraları artık doğrulanamaz.

## 7. Kimlik doğrulama, web güvenliği ve kötüye kullanım sınırları

- Her iki uygulama aynı `ADMIN_PASSWORD` ve `JWT_SECRET` ayarlarını alır, ancak ayrı issuer ve cookie adlarıyla kendi oturumlarını doğrular.
- Parola bcrypt ile kontrol edilir. Başarılı girişte HS256 JWT, `httpOnly`, `SameSite=Strict` cookie olarak verilir; Secure bayrağı `COOKIE_SECURE=1` ile etkinleşir. Oturum kimlikleri süreç içindeki `Set` içinde tutulduğundan yeniden başlatma mevcut oturumları iptal eder.
- Yazma istekleri `X-Requested-With` başlığını ve varsa aynı host'a ait `Origin` başlığını bekler.
- Helmet güvenlik başlıkları ve CSP kullanılır; API ve admin yanıtları önbelleksizdir.
- Uygulama başına ayrı rate limit'ler bulunur: başarısız girişler IP başına 15 dakikada en fazla 5; doğrulama sorguları dakikada 30; PDF indirmeleri dakikada 10; QR üretimi dakikada 10.
- `TRUST_PROXY=1` yalnızca uygulama doğru yapılandırılmış güvenilir ters vekil arkasındaysa kullanılmalıdır; IP tabanlı hız sınırlarını etkiler.
- Üretim HTTPS'inde `COOKIE_SECURE=1` zorunlu kabul edilir. LAN üzerinde HTTP kullanmak oturum trafiğini şifrelemez; yalnızca yönetilen ve güvenilir ağlarda kullanılmalı, internet port yönlendirmesi yapılmamalıdır.
- Audit verisi IP içerir ve otomatik saklama süresi tanımlı değildir. Kurum veri sorumlusu saklama politikasını belirlemelidir.

## 8. API yüzeyi

### Genel doğrulama uygulaması

| Yöntem ve yol | Amaç |
|---|---|
| `GET /api/verify/:token` | QR tokenı ile belge durumunu sorgulama |
| `GET /api/lookup?serial=...` | Seri numarasıyla belge durumunu sorgulama |
| `GET /api/download?token=...` | QR tokenıyla geçerli PDF'i indirme |
| `GET /api/download?serial=...` | Seri numarasıyla geçerli PDF'i indirme |
| `GET /api/public-key` | Ed25519 açık anahtarını, algoritmayı ve parmak izini alma |
| `GET /.well-known/kurum-imza.pem` | PEM açık anahtarını alma |
| `GET /health` | Container healthcheck |

### Yönetici ve QR uygulamaları

| Uygulama | Yöntem ve yol | Amaç |
|---|---|---|
| App | `POST /api/login`, `POST /api/logout` | Yönetici oturumu |
| App | `GET /api/admin/docs` | Arama, filtreleme, sıralama ve sayfalama |
| App | `POST /api/admin/docs` | Yeni belge ve PDF kaydı |
| App | `POST /api/admin/docs/:id/replace` | Geçerli belgeye yeni sürüm ekleme |
| App | `POST /api/admin/docs/:id/invalidate` | Belgeyi geçersiz kılma |
| App | `DELETE /api/admin/docs/:id` | Kaydı geçersizleştirip PDF dosyasını silme |
| App | `GET /api/admin/audit` | Audit zinciri doğrulama ve son kayıtları görüntüleme |
| QR | `POST /api/login`, `GET /api/session`, `POST /api/logout` | QR uygulaması yönetici oturumu |
| QR | `POST /api/qr` | Bellekteki PDF'den QR ve token üretme |

Üretimde QR yolları Caddy tarafından `/qr/` altında sunulur; QR uygulamasının iç API yolları bu nedenle `/qr/api/...` olur.

## 9. Geliştirme ve çalıştırma

### Gereksinimler

- Node.js 20 uyumlu çalışma zamanı; Docker imajı `node:20-bookworm-slim` kullanır.
- Yerel ortamda gerekli environment değerlerini `.env.example` temel alınarak hazırlayın. `ADMIN_PASSWORD`, `JWT_SECRET`, `QR_SECRET` ve `QR_ID_SECRET` için örnek/placeholder değer kullanmayın; gerçek `.env` dosyasını commit etmeyin.
- `QR_SECRET`, `QR_ID_SECRET` ve `JWT_SECRET` birbirinin yerine kullanılamaz; ayrı amaçları vardır.

### Komutlar

```sh
npm ci
npm test
npm start
npm run start:qr
```

`npm start` doğrulama uygulamasını 3000, `npm run start:qr` QR uygulamasını 3001 portunda başlatır. Docker ile yerel iki servisi çalıştırmak için:

```sh
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Yerel override'ın host portları 3100 ve 3101'dir. Compose port eşlemelerinde host IP'si belirtilmediğinden Docker bunları host arayüzlerine yayımlar; yalnızca loopback erişimi isteniyorsa eşlemeleri `127.0.0.1:3100:3000` ve `127.0.0.1:3101:3001` biçimine alın. LAN erişimi için firewall kapsamını daraltın ve `BASE_URL` değerini, QR tarayan diğer cihazlardan erişilebilen doğrulama URL'sine ayarlayın.

Yerel doğrulama ve yönetim: `http://localhost:3100/`, `http://localhost:3100/admin`. QR üretici: `http://localhost:3101/`. Farklı host/portla çalışırken QR'daki doğrulama adresini `BASE_URL` belirler.

### Test

Test koşucusu Node.js'in yerleşik `node:test` modülüdür:

```sh
npm test
```

Mevcut otomatik testler hash'ten seri üretimini, eski/yenilenen seri formatlarını, gerçek ISO tarih kontrolünü ve placeholder secret tespitini kapsar. Tüm Docker uçtan uca akışı otomatik test edilmemektedir; kurulumdan sonra yönetici girişi, QR üretme, son PDF yükleme, doğrulama ve indirme adımları ayrıca denenmelidir.

## 10. Konteyner ve dağıtım

- Tek Node imajı iki servis için kullanılır: app varsayılan `node server.js`; QR servisi `node qr-generator/server.js` komutuyla çalışır.
- App servisi `/data` volume'ünü kullanır; container filesystem'i salt okunur, `/tmp` geçici alandır ve süreç root olmayan `node` kullanıcısıdır.
- Servisler tüm Linux capability'lerini bırakır ve `no-new-privileges` ile çalışır. QR servisi kalıcı volume kullanmaz.
- Üretim Compose yapılandırması Caddy'yi 80/443 üzerinde çalıştırır. Caddy DNS/sertifika işlemlerini yapar; servisler Docker ağı içinde kalır.
- `BASE_URL` HTTPS ise her iki servis için `COOKIE_SECURE=1` ayarlanmalıdır. Reverse proxy arkasında doğru proxy güven sınırı için `TRUST_PROXY` değerlendirilmelidir.
- `docker compose down -v`, dbdata volume'ünü siler. Güncelleme/geri yükleme öncesi volume ve `.env` birlikte yedeklenmelidir.

## 11. Tasarım sınırları ve bakım notları

- Tek bir yönetici hesabı kullanılır; kullanıcı/rol modeli veya 2FA bulunmaz.
- PDF'lere QR'ın eklenmesi operatörün harici iş akışıdır. QR üreticisi yalnızca görsel/token sağlar.
- Müşterinin belgeye erişimi QR veya seri numarasına dayanır; ek müşteri kimlik doğrulaması yoktur.
- Rate limit ve oturum iptal listesi süreç belleğindedir; birden fazla app replikası arasında ortaklaştırılmaz.
- SQLite tek makine/tek yazıcı odaklıdır; çoklu replika ve yüksek eşzamanlı yazma gereksinimi için ayrıca tasarım gerekir.
- Audit görüntüleme endpoint'i vardır, ancak yönetim arayüzünde audit ekranı yoktur.
- Kişisel veri bildirimi örnek metindir; kurumun iletişim bilgileri ve veri saklama politikasıyla gözden geçirilmelidir.

## 12. İlgili belgeler

- [README.md](README.md): kullanıcıya/kurulum sorumlusuna yönelik genel bakış ve özellikler.
- [KURULUM.md](KURULUM.md): fiziksel sunucu kurulumu, yedekleme ve sorun giderme.
