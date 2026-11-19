# Geliştirme Günlüğü

## 2026-11-16
- Kapsam netleşti (bkz. PLAN.md → Kullanıcı kararları). Birebir kopya yerine özgün oyun: **Kervan Yolu**.
- Mevcut `Catan_6_Kisilik_Baski/` klasörü (fiziksel baskı dosyaları) projeye dahil edilmedi; `.gitignore`'da, içeriğine dokunulmadı.
- Monorepo iskeleti kuruldu (npm workspaces, TypeScript). Node 24.11 / npm 11.6.
- Sözleşme yazıldı: `types.ts`, `protocol.ts`, motor API imzaları (stub). Kural seti: `RULES.md`.
- Karar: SQLite için yerleşik `node:sqlite` (yerel derleme gerektirmez).
- Agent sistemi kuruldu: motor, sunucu, istemci agentleri paralel başlatıldı (her biri yalnızca kendi klasöründe).
- Dockerfile + DEPLOY.md eklendi.
- **Motor agenti bitti:** `packages/shared/src/engine/` (board, game, rules, view, rng). 67 test; 2–6 oyunculu rastgele tam oyun testleri dahil.
  - Sözleşme notları: zar atma adımında `dice = null` ("bu tur zar atıldı mı" bilgisi buradan); kurulumdaki başlangıç kaynakları `produced` olayıyla bildirilir; `respondTrade` olay üretmez; `turn` kurulumda 0.
- **Sunucu agenti bitti:** `apps/server/src/` (index, app, ws, rooms, db). 20 test (gerçek motorla WebSocket e2e dahil).
  - Ek hata kodları: `rateLimited`, `internal`. Koltuk başka sekmeden devralınınca eski soket 4000 koduyla kapanır.
- Orkestratör doğrulaması: 87/87 test geçti, shared + server tip denetimi temiz.

## 2026-11-17
- İstemci agenti API kullanım limitine takılıp yarıda kaldı; kaldığı yerden sürdürüldü ve tamamlandı (ana ekran, lobi, oyun, 3D/2D tahta, HUD, temalar, TR/EN, PWA).
- Birleştirme: `npm run typecheck` temiz, `npm test` 87/87, `npm run build` başarılı. `typecheck` betiği düzeltildi (`tsc -b` yerine sırayla `tsc -p`).
- `scripts/bot.ts` eklendi: odaya katılıp basit yasal hamleler oynayan test botu.
- **Tarayıcıda uçtan uca test (derlenmiş tek servis, gerçek sunucu + motor):**
  - Oda kurma → bot katılımı → başlatma; 3D tahtada kurulum (yılan sırası, ikinci obadan başlangıç kaynağı).
  - Zar, oyuncular arası takas (teklif → bot kabul → onay), oyun günlüğü, sohbet, 2D/3D geçişi.
  - Duraklatma → sayfa yenileme (koltuk geri geldi, duraklatma ekranı) → **sunucuyu kapatıp yeniden başlatma** → "Oyunlarım"da "Duraklatıldı" → devam; durum, günlük ve sohbet korunmuş.
  - 6 oyunculu büyük harita (37 karo, hedef 11), Uzay teması, geniş ekran yan paneli, 3D.
- Test edilmeyenler: gerçek telefonda dokunmatik, PWA kurulumu (HTTPS gerekir), oyunun sonuna kadar tarayıcıdan oynanması (motor testlerinde 2–6 oyunculu tam oyunlar var), Docker imajının derlenmesi (bu makinede Docker yok).

## 2026-11-18 — Görsel tasarım v2
- Kullanıcı ilk tasarımı yeterince etkileyici bulmadı. v1, krem zemin + kiremit vurgu + düz prizmalar ile şablon görünümündeydi.
- Yeni yön `docs/DESIGN.md`'de: "Gece kervansarayı" (lapis lake paneller, varak altın, İznik turkuazı/mercanı, Alegreya + Alegreya Sans, Selçuklu yıldızı deseni).
- Agent düzeni: 3D tahtayı orkestratör, 2D arayüzün tamamını (ana ekran, lobi, HUD, diyaloglar, 2D tahta, ikonlar, temalar) UI tasarım agenti yaptı.
- **3D tahta** (`board/Scene3D.tsx`, `decor3d.ts`, `look3d.ts`) — canlı diorama:
  - Kumsal ve koylarıyla bir ada, kıyıda köpük, shader ile deniz ve gökyüzü.
  - Araziye göre süsler: çam/servi, rüzgârda sallanan başaklar, koyunlar, kesme taş, karlı dağ + maden ağzı, yıkık kemer. Temaya göre palmiye ve kristal.
  - Altın çerçeveli madalyon sayı pulları; çadır, kale ve bedesten parçaları kurulunca düşüp yerine oturuyor.
  - Pelerinli eşkıya, parlayan seçim halkaları, açılışta kamera süzülmesi.
- **Ana ekran:** arkada yavaşça dönen canlı ada (`board/Showcase.tsx`). WebGL yoksa boyalı gradyana düşer.
- Bulutlar kaldırıldı: kamera açısında kaya yığını gibi görünüyorlardı.
- Doğrulama: typecheck temiz, 87/87 test, build başarılı.
  - Tarayıcıda gerçek sunucu + 2 botla telefon (375×812) ve masaüstü (1440×900) boyutlarında denendi: ana ekran, lobi, kurulum, zar.
  - Üç temanın 3D görünümü ve 2D tahta da kontrol edildi.
- Not: PWA `autoUpdate` olduğundan bir güncellemeden sonra ilk açılış eski sürümü gösterebilir; ikinci açılışta yenisi gelir.

## 2026-11-19 — Tanıtım klibi ve limanlar
- `/brag` ile 23 sn tanıtım klibi (`brag-output/`, git'e eklenmedi).
  - Gerçek uygulama başsız Chrome'da sanal saatle kare kare çekildi.
  - Müzik ve efektler yerelde sentezlendi.
- **Limanlar (kullanıcı isteği):** kıyı kenarlarına rastgele yerleşen ticaret noktaları.
  - Sayılar: standard 9 (4 × 3:1, 5 × 2:1), large 11 (5 × 3:1, 6 × 2:1).
  - Yerleşim: kıyıya eşit aralıkla yayılıyor, iki liman köşe paylaşmıyor. Ayrı bir PRNG akışı kullanıldığı için mevcut tohumlardaki arazi ve sayılar değişmedi.
  - `bankRate` limanları hesaba katıyor: limanın iki köşesinden birinde binası olan oyuncu yararlanıyor.
  - Sözleşmede `Board.harbors?` var. Alan isteğe bağlı; limanlardan önce kaydedilmiş oyunlar limansız devam ediyor.
  - 3D'de denize uzanan iskele, köşelere kalaslar ve oran madalyonu; liman önündeki kumsal açık suya çevrildi. 2D'de de aynı öğeler var.
  - 7 yeni test, toplam 94/94. Kurallar ve oyun içi özet güncellendi.
- `npm test` artık yalnızca `packages` ve `apps` klasörlerini tarıyor; çekimden kalan Chrome profili testlere karışıyordu.
