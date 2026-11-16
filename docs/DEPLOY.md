# Yayın Kılavuzu

Oyun tek bir Node.js servisidir: aynı port hem arayüzü hem WebSocket'i hem REST'i sunar.
Kalıcı veri tek bir SQLite dosyasıdır (`DATA_DIR/kervan.db`) — **kalıcı disk** bağlanmazsa
her yeniden yayında kayıtlı/duraklatılmış oyunlar silinir.

| Ortam değişkeni | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | 3000 | HTTP + WebSocket portu |
| `DATA_DIR` | `./data` | SQLite dosyasının klasörü |
| `CLIENT_DIST` | otomatik | Derlenmiş istemci klasörü (Docker'da ayarlı) |

## Yerelde üretim modu
```bash
npm install
npm run build
npm start
```
Tarayıcı: http://localhost:3000

## Docker
```bash
docker build -t kervan-yolu .
docker run -p 3000:3000 -v kervan-data:/data kervan-yolu
```

## Render.com (önerilen, en az adım)
1. Projeyi GitHub'a gönder.
2. Render → New → **Web Service** → repoyu seç → Runtime: **Docker**.
3. **Disks** → Add Disk → Mount path `/data`, 1 GB. (Ücretsiz planda disk yoktur; disk için ücretli en küçük plan gerekir.)
4. Deploy. Render HTTPS ve WebSocket'i (wss) kendiliğinden sağlar.

## Fly.io
```bash
fly launch --no-deploy
fly volumes create kervan_data --size 1
```
`fly.toml` içine:
```toml
[mounts]
  source = "kervan_data"
  destination = "/data"
[http_service]
  internal_port = 3000
  force_https = true
```
```bash
fly deploy
```

## Notlar
- PWA kurulumu ve servis çalışanı yalnızca **HTTPS** üzerinde çalışır (localhost hariç).
- Tek kopya (instance) çalıştırın: oda durumu bellekte + SQLite'ta tutulur, yatay ölçekleme desteklenmez.
- Yedek: `kervan.db` dosyasını kopyalamak yeterlidir.
