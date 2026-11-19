# Kervan Yolu — Kurallar (motorun uyguladığı kesin kural seti)

Özgün bir altıgen-harita strateji oyunu. 2–6 oyuncu. Kimlikler (`timber`, `outpost`…) koddaki adlardır;
ekranda görünen adlar temaya göre değişir (bkz. PLAN.md → Temalar).

## Harita
- Sivri-tepeli altıgenler, eksenel koordinat (q, r). Altıgen boyutu 1 → `x = √3·(q + r/2)`, `y = 1.5·r`.
- **standard** (2–4 oyuncu): yarıçap 2 altıgen → 19 karo. **large** (5–6 oyuncu): yarıçap 3 → 37 karo.
- Arazi dağılımı (seed ile karıştırılır):
  - standard: forest 4, pasture 4, field 4, quarry 3, mine 3, barren 1
  - large: forest 8, pasture 7, field 7, quarry 6, mine 6, barren 3
- Sayı pulları (barren hariç her karoya bir tane, seed ile karıştırılır):
  - standard (18): 2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12
  - large (34): 2×2, 3×4, 4×4, 5×4, 6×3, 8×3, 9×4, 10×4, 11×4, 12×2
  - Kısıt: 6 ve 8 taşıyan iki karo komşu olamaz (olursa yeniden karıştır; 200 denemeden sonra olduğu gibi kabul et).
- Eşkıya başlangıçta bir barren karosundadır (en küçük id'li).
- **Limanlar:** Kıyı kenarlarına (tek karoya komşu kenarlar) rastgele yerleşir. standard: 9 (4 × 3:1, 5 × 2:1 — her kaynaktan bir), large: 11 (5 × 3:1, 6 × 2:1 — her kaynaktan bir + bir rastgele kaynak).
  Kıyı boyunca eşit aralıkla, rastgele bir başlangıç noktasından ve ±1 kenar oynamayla dağıtılır; iki liman köşe paylaşmaz. Aynı (size, seed) aynı limanları verir; yerleşim ayrı bir PRNG akışı kullandığı için arazi ve sayılar değişmez.
- Köşe (vertex) ve kenar (edge) kimlikleri 0'dan başlayan sıralı tam sayılardır; aynı (size, seed) her zaman aynı tahtayı üretir.

## Parçalar ve puan
| Parça | Yer | Maliyet | Puan | Limit |
|---|---|---|---|---|
| road (yol) | kenar | timber 1, stone 1 | – | 15 |
| outpost (oba) | köşe | timber 1, stone 1, grain 1, fiber 1 | 1 | 5 |
| keep (kale) — outpost yükseltmesi | köşe | grain 2, ore 3 | 2 | 4 |
| market (pazar) — outpost yükseltmesi | köşe | timber 2, fiber 1, stone 1 | 1 | 3 |
| decree card (ferman) | – | grain 1, fiber 1, ore 1 | – | deste |

- Yükseltince outpost parçası stoğa geri döner. keep ↔ market arası dönüşüm yoktur.
- **Mesafe kuralı:** bir köşeye bina konabilmesi için komşu köşelerin hepsi boş olmalı.
- Yol: kendi binasına ya da kendi yoluna değmeli; aradaki köşede rakip binası varsa o köşeden öteye bağlanamaz.
- Ana evrede outpost: kendi yoluna değen, mesafe kuralına uyan boş köşe.

## Kurulum evresi (setup)
- Tur 1: koltuk sırasıyla (0 → n-1), Tur 2: tersten (n-1 → 0). Her sırada: 1 outpost (bedava, yol bağlantısı aranmaz) sonra o outpost'a değen 1 yol (bedava).
- Tur 2'de konan outpost'un komşu karolarından (barren hariç) birer kaynak alınır.
- Son yol konunca ana evre başlar: `current = 0`, `turn = 1`, `step = 'roll'`.

## Ana evre — sıra akışı
1. **roll**: 2 zar (2d6).
   - Toplam ≠ 7: sayısı tutan ve eşkıya olmayan her karo, köşelerindeki binalara üretir: outpost 1, market 1, keep 2. Banka sınırsızdır. → `step = 'actions'`.
   - Toplam = 7: üretim yok → `step = 'sevenChoice'`. Zarı atan seçer:
     - **tribute (haraç):** bankadan istediği 2 kaynağı alır → `actions`.
     - **bandit (eşkıya):** → `moveBandit`.
2. **moveBandit**: eşkıyayı başka bir karoya taşır. O karonun köşelerinde binası olan ve en az 1 kaynağı olan *rakipler* aday olur:
   0 aday → `actions`; 1 aday → otomatik ondan rastgele 1 kaynak çalınır → `actions`; 2+ aday → `step = 'steal'`, oyuncu `steal {victim}` gönderir.
3. **actions**: sırası gelen oyuncu serbestçe (istediği sırayla, istediği kadar): yol/outpost kurar, yükseltir, ferman alır, en fazla 1 ferman oynar, bankayla takas eder, oyunculara takas teklif eder.
4. **endTurn**: elinde 10'dan fazla kaynak varsa `discard` ile tam olarak (el − 10) kadar kaynağı atmak zorundadır (yoksa `invalidDiscard`). Açık takas iptal olur, `newCards → cards`, `playedCardThisTurn/bargainActive/freeRoads` sıfırlanır, sıra bir sonraki koltuğa geçer (`turn += 1`, `step = 'roll'`).

Zar atmadan önce (`step = 'roll'`) yalnızca `roll` ve `playCard` (raider dahil her ferman) serbesttir.

## Banka takası
`bankTrade {give, want}`: oran kadar `give` verip 1 `want` alır (`give ≠ want`). Oran (`bankRate`):
- 2 — bargain fermanı bu tur etkinse, **veya** oyuncunun bir market'i `give` kaynağını üreten bir karoya komşuysa, **veya** oyuncunun binası `give` için 2:1 bir limanın köşesindeyse
- 3 — oyuncunun en az bir market'i varsa **veya** binası 3:1 bir limanın köşesindeyse
- 4 — aksi halde

## Oyuncular arası takas
- Sırası gelen oyuncu `offerTrade {give, want}` (ikisi de boş olamaz, aynı kaynak iki tarafta olamaz, `give` elinde olmalı). Yeni teklif eskisinin yerini alır.
- Diğer oyuncular `respondTrade {accept}`; kabul edebilmek için `want`'ı karşılayabilmeli (yoksa `cannotAfford`).
- Teklif sahibi `confirmTrade {with}` ile kabul edenlerden biriyle takası yapar (o anda iki tarafın da eli yetmeli) ya da `cancelTrade`.

## Ferman kartları (deste)
| Kart | standard | large | Etki |
|---|---|---|---|
| raider (akıncı) | 12 | 18 | Eşkıyayı taşı (→ `moveBandit` akışı, bitince oynandığı adıma döner: zar atılmadıysa `roll`, atıldıysa `actions`). `raidersPlayed += 1`. |
| caravan (kervan) | 2 | 3 | `freeRoads = min(2, kalan yol parçası)`; sonraki `buildRoad`'lar bedava. Tur sonunda yanar. |
| bounty (bereket) | 2 | 3 | Bankadan seçtiği 2 kaynak. |
| bargain (pazarlık) | 2 | 3 | Tur sonuna kadar tüm banka takasları 2:1. |
| glory (şan) | 4 | 6 | Oynanmaz; elde durdukça gizli +1 puan. |

- Alındığı tur oynanamaz. Turda en fazla 1 ferman (glory sayılmaz). Deste boşsa `deckEmpty`.

## Bonuslar
- **En Uzun Güzergâh (+2):** en az 5 yolluk kesintisiz hat (yol tekrar etmeden; rakip binası hattı o köşede keser). Sahibini ancak *kesin olarak daha uzun* bir hat alır. Sahibin hattı kesilip kısalırsa: en uzun hatta tek başına olan (≥5) alır; eşitlik varsa kimse alamaz.
- **En Güçlü Muhafız (+2):** en az 3 raider oynamış ve en çok oynamış oyuncu; devralmak için kesin olarak fazlası gerekir.

## Kazanma
Puan = outpost×1 + market×1 + keep×2 + bonuslar + glory kartları. Bir oyuncu **kendi sırasında** `targetPoints`'e ulaştığı anda (herhangi bir eylemden sonra kontrol edilir) oyun biter: `phase = 'finished'`, `winner` atanır. Varsayılan hedef: standard 10, large 11.

## Gizlilik (`getView`)
- Rakiplerin kaynak dağılımı ve ferman kartları gizli; yalnızca sayıları görünür. Deste ve `rng` gönderilmez.
- `totalPoints` yalnızca kişinin kendisine; oyun bitince herkese açık.
- `stole` olayında çalınan kaynak yazmaz.
