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
