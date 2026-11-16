# Kervan Yolu — Proje Planı

## Ürün
Altıgen haritalı, kaynak toplama / takas / inşa üzerine kurulu **özgün** çok oyunculu strateji oyunu.
Kutu oyunlarının bu türünden esinlenir; adı, kural seti, kartları, haritası ve görselleri kendine aittir.

Kullanıcı kararları (2026-11-16):
- Temalar değiştirilebilir: **Anadolu Beylikleri (varsayılan)**, Takımada Kolonileri, Uzay Kolonileri.
- Görünüm: döndürülebilir **3D tahta + 2D arayüz**; zayıf cihazlar için 2D tahta modu.
- Platform: **Web + PWA** (telefonda ana ekrana eklenir).
- Çok oyunculu: oda kodu ile davet, oyun içi sohbet, kopunca geri bağlanma, **oyun kayıtları**, **duraklatıp sonra devam etme**.
- 2–6 oyuncu; 5–6 kişi için büyük harita. Bot yok.
- Diller: Türkçe (varsayılan) + İngilizce.
- Kayıt: SQLite. Yayın: buluta hazır tek servis (Dockerfile + kılavuz); yayını kullanıcı yapar.

## Mimari
```
packages/shared   Tipler, WebSocket protokolü, saf (pure) oyun motoru + testler
apps/server       Node 22+ · express (statik + REST) · ws (oyun) · node:sqlite (kalıcılık)
apps/client       Vite · React · three.js (@react-three/fiber) · zustand · PWA
docs/             PLAN.md · RULES.md · DEVLOG.md · DEPLOY.md
```
- **Sunucu otoritesi:** istemci yalnızca `Action` gönderir; sunucu motorla doğrular, durumu SQLite'a yazar, her oyuncuya kendi gizlenmiş `PlayerView`'ını yollar. Hile yapılamaz.
- **Deterministik motor:** `applyAction(state, seat, action)` saf fonksiyon; zar ve karıştırma state içindeki seed'li PRNG'den.
- **Kalıcılık:** her eylemden sonra oda durumu + eylem günlüğü yazılır → sunucu yeniden başlasa da oyun kaldığı yerden sürer. Duraklatma = oda `paused`; oyuncular kod + cihazdaki koltuk anahtarıyla döner.
- **Tek servis yayını:** sunucu derlenmiş istemciyi de sunar (tek port, tek konteyner).

## Temalar (yalnızca görsel + adlandırma; kurallar aynı)
| Kimlik | Anadolu | Takımada | Uzay |
|---|---|---|---|
| timber | Kereste | Bambu | Biyokütle |
| stone | Taş | Mercan Taşı | Regolit |
| grain | Buğday | Pirinç | Yosun Kültürü |
| fiber | Yün | Keten | Polimer |
| ore | Demir | Bakır | Titanyum |
| road / outpost / keep / market | Yol / Oba / Kale / Pazar | Rota / İskele / Hisar / Liman Pazarı | Hat / Üs / İstasyon / Takas Merkezi |
| bandit | Eşkıya | Korsan | Yağmacı Dron |

## Agent sistemi
Sözleşme (`packages/shared/src/types.ts`, `protocol.ts`, `engine/index.ts` imzaları) ana oturumda yazıldı; üç agent paralel çalışır, her biri yalnızca kendi klasörüne yazar:

| Agent | Klasör | Teslim |
|---|---|---|
| Motor | `packages/shared/src/engine/` | Tahta üretimi, kurallar, görünüm, yardımcılar + vitest testleri |
| Sunucu | `apps/server/` | Odalar, WebSocket, SQLite, duraklatma/devam, yeniden bağlanma, sohbet, REST |
| İstemci | `apps/client/` | Ana ekran, lobi, 3D/2D tahta, HUD, takas, sohbet, temalar, i18n, PWA |

Ana oturum (orkestratör): sözleşme, git commit'leri, birleştirme, tip denetimi, tarayıcıda uçtan uca test, yayın dosyaları, DEVLOG.

## Aşamalar
1. İskelet + sözleşme + kurallar ✔
2. Üç agent paralel geliştirme
3. Birleştirme: typecheck, testler, build
4. Tarayıcıda çok oyunculu uçtan uca doğrulama (2 sekme; lobi → kurulum → tur → takas → duraklat/devam → yeniden bağlanma)
5. Dockerfile + DEPLOY.md + README, son commit
