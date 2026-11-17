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
