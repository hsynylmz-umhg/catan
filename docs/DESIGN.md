# Kervan Yolu — Görsel Tasarım (v2)

Kullanıcı geri bildirimi (2026-11-18): ilk tasarım "yeterince etkileyici değil". v1, hazır şablon görünümüne
düşmüştü: krem zemin, kiremit vurgu, serif başlık ve düz altıgen prizmalar. v2 bunların hepsini bırakır.

## Fikir: "Gece kervansarayı"
Oyun, akşam çökerken bir kervansarayın avlusunda, çini kaplı bir masanın üstünde duran **canlı bir diorama**.
Tahta denizde yüzen bir ada: dalgalar kıyıya vurur, buğday sallanır, koyunlar yaylada durur, dağlarda kar var.
Etrafındaki arayüz **lapis lacivert lake** ile **varak altın** çizgilerden oluşur; renkler İznik çinisinden gelir.

**Cesaret tek yerde harcanır: 3D tahta.** Arayüz sakin, disiplinli ve tahtayı çerçeveler.

## Renk (Anadolu teması — varsayılan)
| Ad | Hex | Görev |
|---|---|---|
| Gece lapisi | `#0F1D33` | Ana zemin |
| Lapis | `#18304F` | Paneller (lake) |
| İznik turkuazı | `#2FA39A` | İkincil vurgu, "hazır/olumlu" |
| Mercan kırmızısı | `#C8412F` | Uyarı, 6–8, eşkıya |
| Varak altın | `#E0B354` | Birincil vurgu: aktif sıra, birincil buton, çerçeve çizgileri |
| Fildişi | `#F1E6CF` | Metin, sayı pulları |

Kurallar: altın yalnızca **birincil eylem ve "sıra sende"** için; turkuaz bilgi/onay; mercan uyarı.
Panel kenarları 1px altın (%35 opaklık) + içte 1px koyu çizgi (lake kalınlığı).

Diğer temalar aynı yapıyı farklı malzemeyle kurar:
- **Takımada** — gün ortası lagün: açık mercan kumu zemin `#F4E3C3` değil; *lagün mavisi* `#0E4D5C` paneller, beyaz köpük, palmiye yeşili `#3E8E4E`, hibiskus `#E5546A` vurgu.
- **Uzay** — `#0B0A1A` boşluk, `#1B1838` paneller, plazma camgöbeği `#46E0D8` vurgu, magenta `#D94BC8` uyarı, ince parlayan kenarlar.

## Yazı
- **Alegreya** (serif, kaligrafik) — başlıklar, oyun adı, oyuncu adları, sayı pulları, büyük rakamlar. 700–900 ağırlık.
- **Alegreya Sans** — tüm arayüz metni. 400/500/700.
- Aynı süper-aileden iki zıt yüz; Türkçe karakterler (ğ ş ı İ) tam. `@fontsource` ile kendi sunucumuzdan (PWA çevrimdışı çalışır).
- Ölçek (1.25): 12 · 15 · 19 · 24 · 30 · 38 · 60. Etiketler cümle düzeninde; BÜYÜK HARF etiket, `·` ile birleştirilmiş meta, `→` ekli buton yok.

## Biçim dili
- Köşeler hiyerarşiye göre: ana paneller 18px, butonlar 12px, kaynak kartları 10px, rozetler tam yuvarlak.
- Desen: **sekiz köşeli Selçuklu yıldızı** karo deseni (SVG) — yalnızca boş alanlarda (ana ekran zemini, panel başlık şeridi), %6–10 opaklık.
- Gölge: lake hissi — üstte ince açık ışık çizgisi, altta derin yumuşak gölge. Her kartta aynı gri gölge yok.

## Hareket
Tek orkestre an: **oyun açılışında kamera tahtanın üstünden süzülerek iner** (≈2.2 sn). Bunun dışında hareket yalnızca
oyuncu eylemine cevaptır: parça kurulunca düşüp yerine oturur, zar atılınca zarlar yuvarlanır, kaynak gelince kart parlar.
`prefers-reduced-motion` açıksa hepsi anlık olur. Sürekli hareketler (dalga, başak) çok yavaştır ve arka plandadır.

## 3D tahta (diorama)
- Ada: altıgenlerin altında kum kıyı + kayalık taban; çevresinde shader'lı deniz (dalga, kıyıda köpük), sis, gök gradyanı.
- Işık: alçak sıcak akşam güneşi + soğuk gökyüzü dolgu ışığı, ACES ton eşleme, yumuşak gölge.
- Arazi başına yükseklik ve model: orman (servi + çam kümeleri), tarla (sıra sıra sallanan başaklar), yayla (çimen + koyun),
  taş ocağı (kesme taş blokları + yar), maden (karlı dağ + maden ağzı), bozkır (kuru ot + yıkık kemer).
- Parçalar (oyuncu rengi + altın süs): Oba = **çadır (yurt)**, Kale = **mazgallı kale kulesi**, Pazar = **kubbeli bedesten**, Yol = taş döşeli şerit.
- Sayı pulu: fildişi madalyon, altın çerçeve; 6 ve 8 mercan kırmızısı.
- Seçilebilir yerler: beyaz lekeler değil, **yerde parlayan altın halkalar** (nefes alır gibi).
