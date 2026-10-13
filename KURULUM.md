# Sunucu Kurulum Rehberi (Stajyer için)

**Amaç:** Doğrulama sistemini kurumun fiziksel sunucusuna, alan adı ve HTTPS ile kurmak. **Süre:** yaklaşık 1–2 saat. Komutları olduğu gibi kopyalayıp yapıştırın; satır başındaki `$` işaretini yazmayın. Büyük harfli `SUNUCU_IP`, `KULLANICI`, `ALAN_ADI` yerlerini kendi değerlerinizle değiştirin.

**Kısa sözlük:** *Terminal*: komut yazılan ekran. *SSH*: sunucuya uzaktan terminal bağlantısı. *Docker*: programı hazır paket (konteyner) olarak çalıştıran araç. *.env*: parolaların ve ayarların durduğu gizli dosya.

---

## 0. Başlamadan önce BT birimiyle netleştirin
- [ ] Sunucuda **Ubuntu Server 22.04 veya 24.04 LTS** kurulu (en az 2 çekirdek, 2 GB RAM, 20 GB boş disk)
- [ ] SSH erişimi (kullanıcı adı, parola) ve `sudo` yetkisi
- [ ] Sunucuya **sabit IP**
- [ ] **Alan adı** (örn. `dogrulama.kurum.edu.tr`) ve DNS'te bu adı **sunucunun dışarıdan görünen genel IP'sine** yönlendiren **A kaydı**
- [ ] İnternetten sunucuya **80 ve 443 portlarının** açılması/yönlendirilmesi (müşteriler QR'ı dışarıdan okutacak; HTTPS sertifikası da buna ihtiyaç duyar)
- [ ] Sunucunun internete çıkabilmesi (Docker kurulumu ve sertifika için)
- [ ] Yedekleri koyacağınız, sunucudan **ayrı** bir depolama alanı
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
`docker-compose.yml`, `server.js`, `public`, `KURULUM.md` gibi dosyaları görmelisiniz. **Bundan sonraki tüm komutlar `/opt/kostu-dogrulama` klasöründe çalıştırılır.**

## 5. Ayar dosyasını (.env) hazırlayın
Gizli anahtarları otomatik üreten dosyayı oluşturun:
```
cat > .env <<EOF
ADMIN_PASSWORD=BURAYA_GUCLU_PAROLA
JWT_SECRET=$(openssl rand -hex 32)
QR_SECRET=$(openssl rand -hex 32)
BASE_URL=https://ALAN_ADI
COOKIE_SECURE=1
TRUST_PROXY=1
BIND=127.0.0.1
DOMAIN=ALAN_ADI
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
EOF
chmod 600 .env
nano .env
```
`nano` içinde ok tuşlarıyla gezin; **`BURAYA_GUCLU_PAROLA`** yerine admin parolasını, **iki `ALAN_ADI`** yerine alan adını yazın (`https://` kalsın). Kaydet: `Ctrl+O`, `Enter`; çık: `Ctrl+X`.

Parola kuralları: en az 12 karakter; harf, rakam, `-` ve `_` kullanın; `#`, `$`, tırnak ve boşluk **kullanmayın**; "password", "changeme", "degistir" içermesin. Parolayı kurumun parola yöneticisine/kasasına kaydedin.

**Çok önemli:** `cat .env` komutuyla çıkan `QR_SECRET` değerini ve `.env` dosyasının tamamını güvenli bir yere kaydedin. `QR_SECRET` kaybolur veya değişirse tüm QR'lar ve imzalar çalışmaz.

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
docker compose up -d --build
docker compose ps
docker compose logs --tail 50
```
İlk seferde indirme/derleme 3–10 dakika sürebilir. `docker compose ps` çıktısında `app` ve `caddy` **Up** (app için `healthy`) olmalı. Loglarda `Doğrulama sistemi :3000` görünmelidir. HTTPS sertifikasını Caddy 1–2 dakikada kendisi alır.

## 8. Test edin
1. Tarayıcıda `https://ALAN_ADI/admin` açın: giriş ekranı gelmeli, adres çubuğunda kilit simgesi olmalı.
2. `ADMIN_PASSWORD` ile giriş yapın.
3. Müşteri adı `TEST` olacak şekilde örnek bir PDF yükleyin. Ekranda çıkan **seri no**'yu kopyalayın.
4. "QR indir" ile QR'ı alın, telefonunuzla **kurum Wi‑Fi'si dışında (mobil veri)** okutun: "Belge geçerli" sayfası açılmalı.
5. Sayfadaki **Görüntüle** ve **İndir** düğmelerini deneyin (parola gerekmez).
6. Testi bitirince test belgesini panelden **Sil**'in (kayıt "geçersiz" olarak kalır; bu normaldir).

## 9. Yedekleme (en önemli iş)
Geri dönüş için **ikisi birlikte** gerekir: (a) veri volume'ü (veritabanı, şifreli PDF'ler, imza anahtarı), (b) `.env` dosyası.
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
- `.env`'i e-postayla/mesajla paylaşmak
- `.env` içindeki `BIND` değerini değiştirip 3000 portunu dışarı açmak
- Yedek almadan güncelleme yapmak

## 13. Sorun giderme
| Belirti | Olası neden / çözüm |
|---|---|
| Site açılmıyor | DNS veya 80/443 yönlendirmesi eksik. `nslookup ALAN_ADI` doğru IP'yi vermeli; `sudo ufw status`; BT'ye sorun |
| Sertifika/kilit hatası | `docker compose logs caddy`: DNS yanlış veya 80 portu dışarıdan kapalı olabilir |
| `app` sürekli yeniden başlıyor, logda "Güvensiz ayar" | `.env` hatalı: parola kısa/yasak kelime, anahtarlar kısa veya aynı, `BASE_URL` `https://` ama `COOKIE_SECURE=1` değil. Düzeltip `docker compose up -d` |
| "Çok fazla deneme" | 15 dakika bekleyin (5 hatalı girişte IP kilitlenir) |
| Giriş yapılıyor ama panel açılmıyor | Siteye `http://` ile girilmiş; `https://` kullanın |
| QR yanlış adrese gidiyor | `.env` içinde `BASE_URL` yanlış. Düzeltince eski QR'lar eski adresi taşır; yeniden üretilip basılmalı |
| Disk doluyor | `df -h`; `docker image prune` (başka `prune` seçeneği kullanmayın) |

Yardım isterken `docker compose ps` ve `docker compose logs --tail 100` çıktısını iletin (**`.env` içeriğini göndermeyin**).

## 14. Teslim kontrol listesi
- [ ] `https://ALAN_ADI` kilitle açılıyor, admin girişi çalışıyor
- [ ] Test QR'ı mobil veriyle okutuldu, görüntüleme/indirme çalıştı
- [ ] `.env` ve `QR_SECRET` güvenli yerde (parola yöneticisi/kasa)
- [ ] Yedek alındı, **sunucu dışına** kopyalandı, geri yükleme denendi
- [ ] `sudo reboot` sonrası site kendiliğinden geri geldi
- [ ] Yetkili kişilere teslim: alan adı/DNS bilgisi, güvenlik duvarı ayarları, admin parolasının saklandığı yer, bu rehber
