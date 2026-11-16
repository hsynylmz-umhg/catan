# Geliştirme Günlüğü

## 2026-11-16
- Kapsam netleşti (bkz. PLAN.md → Kullanıcı kararları). Birebir kopya yerine özgün oyun: **Kervan Yolu**.
- Mevcut `Catan_6_Kisilik_Baski/` klasörü (fiziksel baskı dosyaları) projeye dahil edilmedi; `.gitignore`'da, içeriğine dokunulmadı.
- Monorepo iskeleti kuruldu (npm workspaces, TypeScript). Node 24.11 / npm 11.6.
- Sözleşme yazıldı: `types.ts`, `protocol.ts`, motor API imzaları (stub). Kural seti: `RULES.md`.
- Karar: SQLite için yerleşik `node:sqlite` (yerel derleme gerektirmez).
