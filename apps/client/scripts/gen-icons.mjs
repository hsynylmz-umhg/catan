// Generates public/icon-192.png, public/icon-512.png and public/icon.svg using only Node built-ins.
// Run: node apps/client/scripts/gen-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
fs.mkdirSync(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });

// "Night caravanserai" palette (docs/DESIGN.md): night lapis, lapis, İznik turquoise, gold leaf, ivory.
const C = {
  bg: [15, 29, 51],
  bg2: [24, 48, 79],
  cream: [241, 230, 207],
  teal: [47, 163, 154],
  gold: [224, 179, 84],
};
const S3 = Math.sqrt(3);
const inHex = (x, y, R) => Math.abs(x) <= (R * S3) / 2 && Math.abs(y) + Math.abs(x) / S3 <= R;
const inStar = (x, y, a) => (Math.abs(x) <= a && Math.abs(y) <= a) || Math.abs(x) + Math.abs(y) <= a * Math.SQRT2;

// Colour at normalised coords (-1..1).
function shade(x, y) {
  if (inStar(x, y, 0.09)) return C.bg;
  if (inStar(x, y, 0.24)) return C.gold;
  if (inHex(x, y, 0.5)) return C.teal;
  if (inHex(x, y, 0.56)) return C.bg;
  if (inHex(x, y, 0.62)) return C.gold;
  // a faint ring of lapis lacquer behind the medallion
  const r = Math.hypot(x, y);
  return r < 0.8 ? C.bg2 : C.bg;
}

function render(size) {
  const ss = 3;
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((px + (sx + 0.5) / ss) / size) * 2 - 1;
          const y = ((py + (sy + 0.5) / ss) / size) * 2 - 1;
          const c = shade(x, y);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (py * size + px) * 4;
      const n = ss * ss;
      buf[i] = Math.round(r / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(b / n); buf[i + 3] = 255;
    }
  }
  return buf;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const rgba = render(size);
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hexPts = (R) =>
  [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${(50 + 50 * R * Math.cos(a)).toFixed(2)},${(50 + 50 * R * Math.sin(a)).toFixed(2)}`;
    })
    .join(' ');
const starPts = (a) => {
  const p = [];
  for (let i = 0; i < 16; i++) {
    const ang = (Math.PI / 8) * i;
    const rad = i % 2 === 0 ? a * Math.SQRT2 : a / Math.cos(Math.PI / 8) * 1.0;
    p.push(`${(50 + 50 * rad * Math.cos(ang)).toFixed(2)},${(50 + 50 * rad * Math.sin(ang)).toFixed(2)}`);
  }
  return p.join(' ');
};
const rgb = (c) => `rgb(${c.join(',')})`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${rgb(C.bg)}"/>
  <circle cx="50" cy="50" r="40" fill="${rgb(C.bg2)}"/>
  <polygon points="${hexPts(0.62)}" fill="${rgb(C.gold)}"/>
  <polygon points="${hexPts(0.56)}" fill="${rgb(C.bg)}"/>
  <polygon points="${hexPts(0.5)}" fill="${rgb(C.teal)}"/>
  <polygon points="${starPts(0.24)}" fill="${rgb(C.gold)}"/>
  <polygon points="${starPts(0.09)}" fill="${rgb(C.bg)}"/>
</svg>
`;

fs.writeFileSync(out('icon-192.png'), png(192));
fs.writeFileSync(out('icon-512.png'), png(512));
fs.writeFileSync(out('icon.svg'), svg);
console.log('icons written');
