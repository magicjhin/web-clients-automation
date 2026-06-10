/**
 * gen-icons.mjs — генерация PNG-иконок для PWA манифеста
 * Создаёт icon-192.png, icon-512.png, apple-touch-icon-180.png
 * через чистый Node.js (zlib + Buffer), без сторонних зависимостей.
 *
 * Использование: node scripts/gen-icons.mjs
 */

import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

// Brand color #1d4ed8 → R=29, G=78, B=216
const BRAND_R = 29;
const BRAND_G = 78;
const BRAND_B = 216;

/** Encode uint32 big-endian to 4 bytes */
function u32be(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

/** CRC32 for PNG chunks */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  return Buffer.concat([u32be(data.length), body, u32be(crc32(body))]);
}

/**
 * Generate a minimal valid PNG.
 * Draws a solid brand-color background with a white rounded square "L" letter.
 * We approximate "L" as filled rectangles (no font rendering needed).
 */
function generatePNG(size) {
  // --- Letter "L" geometry (proportional to size) ---
  // Stem: vertical bar on left-center
  // Base: horizontal bar at bottom

  const margin = Math.round(size * 0.22);
  const strokeW = Math.round(size * 0.16);

  const stemX1 = Math.round(size * 0.30);
  const stemX2 = stemX1 + strokeW;
  const stemY1 = margin;
  const stemY2 = size - margin;

  const baseX1 = stemX1;
  const baseX2 = size - margin;
  const baseY1 = size - margin - strokeW;
  const baseY2 = size - margin;

  // Build raw pixel data: each row = filter byte (0) + RGBA pixels
  const rowSize = 1 + size * 4; // filter + R G B A per pixel
  const rawData = Buffer.alloc(rowSize * size, 0);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Determine if this pixel is "L" letter
      const inStem = x >= stemX1 && x < stemX2 && y >= stemY1 && y < stemY2;
      const inBase = x >= baseX1 && x < baseX2 && y >= baseY1 && y < baseY2;
      const inLetter = inStem || inBase;

      if (inLetter) {
        rawData[pxOffset] = 255;   // R (white)
        rawData[pxOffset + 1] = 255; // G
        rawData[pxOffset + 2] = 255; // B
        rawData[pxOffset + 3] = 255; // A
      } else {
        rawData[pxOffset] = BRAND_R;
        rawData[pxOffset + 1] = BRAND_G;
        rawData[pxOffset + 2] = BRAND_B;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  // Compress with deflate (zlib format, PNG requires zlib wrapper)
  const compressed = deflateSync(rawData, { level: 6 });

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth (8), color type (2=RGB → use 6=RGBA), ...
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);   // width
  ihdrData.writeUInt32BE(size, 4);   // height
  ihdrData[8] = 8;   // bit depth
  ihdrData[9] = 6;   // color type: RGBA
  ihdrData[10] = 0;  // compression
  ihdrData[11] = 0;  // filter
  ihdrData[12] = 0;  // interlace

  const ihdr = pngChunk('IHDR', ihdrData);
  const idat = pngChunk('IDAT', compressed);
  const iend = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon-180.png', size: 180 },
];

for (const { name, size } of sizes) {
  const png = generatePNG(size);
  const outPath = join(PUBLIC, name);
  writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${size}x${size}, ${png.length} bytes)`);
}

console.log('Done.');
