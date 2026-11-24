// アプリのロゴ（src/assets/logo.svg）と同じ絵を、PNG にして、public/ に書き出す。
//  ・iPhone の「ホーム画面に追加」は、SVG を使えず、PNG（apple-touch-icon）が要る
//  ・外部の部品は使わない（絵を、このファイルの中で、描いて、PNG に書く）。ロゴの絵を変えたときは、ここの図形も、logo.svg に合わせる
//  ・できるもの: public/apple-touch-icon.png（180px。角は丸くしない。iPhone が、丸く切る）、public/icon-192.png・icon-512.png（角丸）
// 使い方（プロジェクトの直下で）: node tools/make_icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(OUT, { recursive: true });

// ---------- 図形（512 x 512 の座標。logo.svg と同じ） ----------
const dist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const polyline = (pts, width) => (x, y) => {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i += 1) d = Math.min(d, dist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d <= width / 2;
};
const polygon = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const circle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) <= r;
const ring = (cx, cy, r, width) => (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - r) <= width / 2;
const roundRect = (size, radius) => (x, y) => {
  if (radius <= 0) return x >= 0 && x <= size && y >= 0 && y <= size;
  const cx = Math.min(Math.max(x, radius), size - radius), cy = Math.min(Math.max(y, radius), size - radius);
  return x >= 0 && x <= size && y >= 0 && y <= size && Math.hypot(x - cx, y - cy) <= radius;
};

const WHITE = [255, 255, 255];
const GREEN = [30, 158, 90];
const DARK = [23, 128, 74];
const YELLOW = [255, 210, 63];

// 角の枠（白）
const brackets = [
  [[96, 168], [96, 112], [152, 112]], [[360, 112], [416, 112], [416, 168]],
  [[96, 344], [96, 400], [152, 400]], [[360, 400], [416, 400], [416, 344]],
].map((p) => polyline(p, 26));
// レシート（-8 度。中心 (230, 250) のまわり）。図形は、回した座標で調べる
const rot = (x, y) => {
  const a = (8 * Math.PI) / 180, dx = x - 230, dy = y - 250;
  return [230 + dx * Math.cos(a) - dy * Math.sin(a), 250 + dx * Math.sin(a) + dy * Math.cos(a)];
};
const receiptBody = polygon([[150, 172], [172, 152], [194, 172], [216, 152], [238, 172], [260, 152], [282, 172], [282, 372], [150, 372]]);
const receiptLines = [[184, 304, 222], [184, 268, 260], [184, 280, 298], [184, 244, 336]].map(([x1, x2, y]) => polyline([[x1, y], [x2, y]], 16));
const coin = circle(330, 316, 72);
const coinRing = ring(330, 316, 72, 14);
const check = polyline([[298, 318], [322, 342], [368, 290]], 22);

/** 1 点の色（図形を、下から順に重ねる） */
const colorAt = (x, y, size) => {
  // 背景（斜めの緑のグラデーション）。台の外は、透明
  let rgba = null;
  if (size.mask(x, y)) {
    const t = (x + y) / 1024;
    rgba = [37 + (23 - 37) * t, 179 + (128 - 179) * t, 106 + (74 - 106) * t, 255].map((v, i) => (i < 3 ? Math.round(v) : v));
  } else {
    return [0, 0, 0, 0];
  }
  const paint = (c) => { rgba = [c[0], c[1], c[2], 255]; };
  if (brackets.some((f) => f(x, y))) paint(WHITE);
  const [rx, ry] = rot(x, y);
  if (receiptBody(rx, ry)) {
    paint(WHITE);
    if (receiptLines.some((f) => f(rx, ry))) paint(GREEN);
  }
  if (coin(x, y)) paint(YELLOW);
  if (coinRing(x, y)) paint(GREEN);
  if (check(x, y)) paint(DARK);
  return rgba;
};

// ---------- PNG に書く ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const render = (px, rounded) => {
  const SS = 3; // 1 画素を 3 x 3 に分けて、縁をなめらかにする
  const scale = 512 / px;
  const mask = roundRect(512, rounded ? 112 : 0);
  const raw = Buffer.alloc((px * 4 + 1) * px);
  for (let y = 0; y < px; y += 1) {
    raw[y * (px * 4 + 1)] = 0;
    for (let x = 0; x < px; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const c = colorAt((x + (sx + 0.5) / SS) * scale, (y + (sy + 0.5) / SS) * scale, { mask });
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const o = y * (px * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round(a / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8; // 8 ビット
  ihdr[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

const files = [
  ['apple-touch-icon.png', 180, false],
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
];
files.forEach(([name, px, rounded]) => {
  const png = render(px, rounded);
  writeFileSync(OUT + name, png);
  console.log(`${name}（${px}px・${(png.length / 1024).toFixed(1)}KB）`);
});
console.log(`書き出しました: ${OUT}`);
