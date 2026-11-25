# Sunucu Kurulum Rehberi (Stajyer için)

**Amaç:** Doğrulama sistemini kurumun fiziksel sunucusuna, alan adı ve HTTPS ile kurmak. **Süre:** yaklaşık 1–2 saat. Komutları olduğu gibi kopyalayıp yapıştırın; satır başındaki `$` işaretini yazmayın. Büyük harfli `SUNUCU_IP`, `KULLANICI`, `ALAN_ADI` yerlerini kendi değerlerinizle değiştirin.

**Kısa sözlük:** *Terminal*: komut yazılan ekran. *SSH*: sunucuya uzaktan terminal bağlantısı. *Docker*: programı hazır paket (konteyner) olarak çalıştıran araç. *.env*: parolaların ve ayarların durduğu gizli dosya.

---

## 0. Başlamadan önce BT birimiyle netleştirin
- [ ] Sunucuda **Ubuntu Server 22.04 veya 24.04 LTS** kurulu (en az 2 çekirdek, 2 GB RAM, 20 GB boş disk)
- [ ] SSH erişimi (kullanıcı adı, parola) ve `sudo` yetkisi
- [ ] Sunucuya **sabit IP**
- [ ] **Alan adı** (örn. `dogrulama.kurum.edu.tr`) ve DNS'te bu adı **sunucunun dışarıdan görünen genel IP'sine** yönlendiren **A kaydı**
- [ ] İnternetten sunucuya yalnızca **80 ve 443 portlarının** açılması/yönlendirilmesi (müşteriler QR'ı dışarıdan okutacak; HTTPS sertifikası da buna ihtiyaç duyar). **3000/3001 portlarını açmayın**; uygulamalar Docker iç ağında çalışır.
- [ ] Sunucunun internete çıkabilmesi (Docker kurulumu ve sertifika için)
- [ ] Yedekleri koyacağınız, sunucudan **ayrı** bir depolama alanı
- [ ] Kurumun kişisel veri sorumlusu, genel gizlilik metnini ve IP/audit kayıtlarının saklama politikasını onayladı
- [ ] Proje dosyası `kostu-dogrulama.zip`

> Sunucu yalnızca kurum iç ağındaysa müşteriler siteye ulaşamaz ve HTTPS sertifikası alınamaz. Bu durumda kurulumu durdurup BT ile konuşun.

## 1. Sunucuya bağlanın
Kendi bilgisayarınızda PowerShell (Windows) veya Terminal (Mac) açın:
```
ssh KULLANICI@SUNUCU_IP
```
İlk bağlantıda `yes` yazın. Parola yazarken ekranda hiçbir şey görünmemesi normaldir. Satır `kullanici@sunucu:~$` gibi görünürse bağlandınız.

## 2. Sistemi güncelleyin, saati kontrol edin
```
sudo apt update && sudo apt upgrade -y
timedatectl
```
Çıktıda `System clock synchronized: yes` olmalı. Değilse: `sudo timedatectl set-ntp true`

## 3. Docker kurun
```
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```
`exit` bağlantıyı kapatır. Tekrar `ssh KULLANICI@SUNUCU_IP` ile bağlanın ve deneyin:
```
docker --version
docker compose version
docker run --rm hello-world
```
`Hello from Docker!` yazısını görmelisiniz. Olmazsa resmi rehber: docs.docker.com/engine/install/ubuntu

## 4. Proje dosyalarını sunucuya kopyalayın
**Kendi bilgisayarınızda** (zip'in bulunduğu klasörde, yeni bir PowerShell/Terminal penceresi):
```
scp kostu-dogrulama.zip KULLANICI@SUNUCU_IP:~/
```
**Sunucuda:**
```
sudo apt install -y unzip
sudo unzip ~/kostu-dogrulama.zip -d /opt
sudo chown -R $USER:$USER /opt/kostu-dogrulama
cd /opt/kostu-dogrulama
ls
```
`docker-compose.yml`, `server.js`, `qr-generator`, `public`, `KURULUM.md` gibi dosyaları görmelisiniz. **Bundan sonraki tüm komutlar `/opt/kostu-dogrulama` klasöründe çalıştırılır.**

## 5. Ayar dosyasını (.env) hazırlayın
Bu bölüm yalnızca **yeni sunucu kurulumu** içindir. `.env` zaten varsa bu komutu çalıştırmayın ve mevcut anahtarları değiştirmeyin; özellikle `QR_SECRET` değişikliği yedeklenmiş verilerin çözülememesine neden olur.

Gizli anahtarları otomatik üreten dosyayı oluşturun:
```
cat > .env <<EOF
ADMIN_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
QR_SECRET=$(openssl rand -hex 32)
QR_ID_SECRET=$(openssl rand -hex 32)
BASE_URL=https://ALAN_ADI
COOKIE_SECURE=1
TRUST_PROXY=1
DOMAIN=ALAN_ADI
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
EOF
chmod 600 .env
nano .env
```
Komut güvenli, rastgele bir admin parolası ve üç ayrı anahtar üretir. Üretilen admin parolasını güvenli parola kasasına kaydedin. `nano` içinde **`ALAN_ADI`** yerine alan adınızı yazın (`https://` kalsın). Kaydet: `Ctrl+O`, `Enter`; çık: `Ctrl+X`.

Parola kuralları: en az 12 karakter; harf, rakam, `-` ve `_` kullanın; `#`, `$`, tırnak ve boşluk **kullanmayın**; "password", "changeme", "degistir" içermesin. Parolayı kurumun parola yöneticisine/kasasına kaydedin.

**Çok önemli:** `.env` dosyasının tamamını güvenli bir yere kaydedin. `QR_SECRET` kaybolur veya değişirse mevcut imzalar ve PDF'ler çözülemez. `QR_ID_SECRET` kaybolursa mevcut kayıtlı QR'lar çalışır; ancak aynı kaynak PDF yeniden QR üretildiğinde aynı token üretilemez.

Audit kayıtları IP adresi içerir ve şu an otomatik silinmez. Saklama süresi belirlenmeden üretim kullanımı için kurumun veri sorumlusu onayı alın.

## 6. Güvenlik duvarı (sunucu üzerinde)
**Sırayı bozmayın**, ilk satır SSH bağlantınızı korur:
```
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```
(Kurumun ağ güvenlik duvarı ayrıca BT tarafında ayarlanır.)

## 7. Sistemi başlatın
```
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail 50
```
İlk seferde indirme/derleme 3–10 dakika sürebilir. `docker compose ps` çıktısında `app`, `qr` ve `caddy` **Up** (app ve qr için `healthy`) olmalı. Loglardaki `:3000` ve `:3001` uygulamaların **Docker içindeki** portlarıdır; host portu olarak yayımlanmazlar. Caddy dışarıya yalnızca 80/443 portlarını açar. QR üreticisi aynı alan adında `https://ALAN_ADI/qr/` adresindedir; HTTPS sertifikasını Caddy 1–2 dakikada kendisi alır.

## 8. Test edin
1. `https://ALAN_ADI/qr/` ve `https://ALAN_ADI/admin` adreslerini açın; ikisi de HTTPS ile gelmeli.
2. Her iki ekranda da `ADMIN_PASSWORD` ile giriş yapılabildiğini doğrulayın.
3. QR üreticide QR'sız bir test PDF'i yükleyin; QR PNG'si ve token görünmeli. Aynı dosyayı tekrar yükleyince aynı token üretilmeli.
4. QR'ı PDF'e elle ekleyin; seri numarası eklemeyin. Bu son PDF'i `/admin` panelinde token ve belge bilgileriyle yükleyin.
5. Sistem seri no'yu `KTLAB-` önekiyle son PDF SHA-256 hash'inin ilk 32 hex karakterinden üretmeli; tam hash içeride saklanıp imzalanır. QR'ı telefonla **kurum Wi‑Fi'si dışında (mobil veri)** okutun: "Belge geçerli" görünmeli.
6. Sayfadaki **Görüntüle** ve **İndir** düğmelerini deneyin. PDF erişimi için parola gerekmez; QR veya seri no'yu bilen herkes geçerli belgenin son PDF'ini indirebilir.
7. Aynı tokenı veya aynı son PDF'i yeniden kaydetmeyi deneyin; sistem ikinci kaydı reddetmeli. Testi bitirince belgeyi panelden **Sil**'in (kayıt "geçersiz" olarak kalır; bu normaldir).

## 9. Yedekleme (en önemli iş)
Geri dönüş için **ikisi birlikte** gerekir: (a) veri volume'ü (veritabanı, şifreli son PDF'ler, imza anahtarı), (b) `.env` dosyası (`QR_SECRET` ve `QR_ID_SECRET` dahil).
```
cd /opt/kostu-dogrulama
mkdir -p ~/yedek
docker volume ls | grep dbdata
```
Son komut `kostu-dogrulama_dbdata` gibi bir ad göstermeli (farklıysa aşağıda onu kullanın). Yedek alın:
```
docker compose stop app
docker run --rm -v kostu-dogrulama_dbdata:/data -v ~/yedek:/yedek alpine tar czf /yedek/veri-$(date +%F).tar.gz -C /data .
docker compose start app
cp .env ~/yedek/env-$(date +%F).bak && chmod 600 ~/yedek/*
```
Uygulama birkaç saniye durur. Sonra `~/yedek` klasörünü **sunucu dışına** kopyalayın (BT'nin yedek sistemi veya başka bir bilgisayara `scp`). Öneri: haftada bir ve çok sayıda belge yüklendikten sonra.

**Geri yükleme (acil durumda, BT/yönetici onayıyla):**
```
cd /opt/kostu-dogrulama
docker compose stop app
docker run --rm -v kostu-dogrulama_dbdata:/data -v ~/yedek:/yedek alpine sh -c "rm -rf /data/* && tar xzf /yedek/veri-TARIH.tar.gz -C /data"
docker compose start app
```
`.env` dosyası yedekteki ile aynı olmalıdır. Geri yüklemeyi bir kez önceden test edin.

## 10. Güncelleme
1. Önce §9'daki yedeği alın.
2. Yeni zip'i `scp` ile kopyalayın, sonra:
```
cd /opt && sudo unzip -o ~/kostu-dogrulama.zip && sudo chown -R $USER:$USER /opt/kostu-dogrulama
cd /opt/kostu-dogrulama && docker compose up -d --build
```
`.env` zip'in içinde olmadığı için korunur.

## 11. Günlük komutlar
| İş | Komut |
|---|---|
| Durum | `docker compose ps` |
| Canlı log | `docker compose logs -f --tail 100` |
| Yeniden başlat | `docker compose restart` |
| Durdur / başlat | `docker compose stop` / `docker compose start` |
| Admin parolasını değiştir | `nano .env` sonra `docker compose up -d` |

Sunucu yeniden başlarsa sistem kendiliğinden açılır.

## 12. Asla yapmayın
- `docker compose down -v` veya `docker volume rm`: **tüm belgeleri ve anahtarları siler**
- `QR_SECRET`'ı değiştirmek veya kaybetmek
- `.env`'i yedeklemeden `QR_ID_SECRET`'ı değiştirmek; aynı kaynak PDF yeniden QR üretildiğinde farklı token oluşur
- `.env`'i e-postayla/mesajla paylaşmak
- Compose yapılandırmasına app/QR servisleri için host `ports` eşlemesi eklemek veya 3000/3001 portlarını internete açmak
- Yedek almadan güncelleme yapmak

## 13. Sorun giderme
| Belirti | Olası neden / çözüm |
|---|---|
| Site açılmıyor | DNS veya 80/443 yönlendirmesi eksik. `nslookup ALAN_ADI` doğru IP'yi vermeli; `sudo ufw status`; BT'ye sorun |
| Sertifika/kilit hatası | `docker compose logs caddy`: DNS yanlış veya 80 portu dışarıdan kapalı olabilir |
| `app` veya `qr` sürekli yeniden başlıyor | `.env` hatalı olabilir: parola kısa/yasak kelime, anahtarlar kısa veya aynı, `BASE_URL` `https://` ama `COOKIE_SECURE=1` değil. `docker compose logs --tail 100 app qr` ile inceleyip düzeltin |
| "Çok fazla deneme" | 15 dakika bekleyin (5 hatalı girişte IP kilitlenir) |
| Giriş yapılıyor ama panel açılmıyor | Siteye `http://` ile girilmiş; `https://` kullanın |
| QR yanlış adrese gidiyor | `.env` içinde `BASE_URL` yanlış. Düzeltince eski QR'lar eski adresi taşır; yeniden üretilip basılmalı |
| Disk doluyor | `df -h`; `docker image prune` (başka `prune` seçeneği kullanmayın) |

Yardım isterken `docker compose ps` ve `docker compose logs --tail 100` çıktısını iletin (**`.env` içeriğini göndermeyin**).

## 14. Teslim kontrol listesi
- [ ] `https://ALAN_ADI` kilitle açılıyor, admin girişi çalışıyor
- [ ] Test QR'ı mobil veriyle okutuldu, görüntüleme/indirme çalıştı
- [ ] `.env` ve `QR_SECRET` güvenli yerde (parola yöneticisi/kasa)
- [ ] `QR_ID_SECRET` de `.env` yedeğiyle birlikte güvenli yerde
- [ ] Yedek alındı, **sunucu dışına** kopyalandı, geri yükleme denendi
- [ ] `sudo reboot` sonrası site kendiliğinden geri geldi
- [ ] Yetkili kişilere teslim: alan adı/DNS bilgisi, güvenlik duvarı ayarları, admin parolasının saklandığı yer, bu rehber
