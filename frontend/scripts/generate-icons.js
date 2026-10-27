import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// --- CRC32 & PNG Builder ---
const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[i] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function createPng(width, height, getPixel) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = Math.round(r);
      rawData[pxOffset + 1] = Math.round(g);
      rawData[pxOffset + 2] = Math.round(b);
      rawData[pxOffset + 3] = Math.round(a);
    }
  }

  const idatData = zlib.deflateSync(rawData, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- SDF Distance Functions ---
function distToSegment(px, py, ax, ay, bx, by) {
  const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

function distToRoundedRect(x, y, w, h, r) {
  const cx = x - w / 2;
  const cy = y - h / 2;
  const qx = Math.abs(cx) - (w / 2 - r);
  const qy = Math.abs(cy) - (h / 2 - r);
  const outerX = Math.max(qx, 0);
  const outerY = Math.max(qy, 0);
  const dOuter = Math.hypot(outerX, outerY);
  const dInner = Math.min(Math.max(qx, qy), 0);
  return dOuter + dInner - r;
}

// --- Logo Pixel Renderer ---
function renderLogoPixel(x, y, width, height, isMaskable = false) {
  // Supersampling 2x2 for ultra-smooth edges
  let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
  const subOffsets = [0.25, 0.75];

  const scale = width / 512;
  const vScale = isMaskable ? 0.82 : 1.0;

  // Key geometry in 512x512 space
  const strokeWidth = 54 * scale * vScale;
  const strokeRadius = strokeWidth / 2;

  const ax = (256 - 90 * vScale) * scale;
  const ay = (256 - 96 * vScale) * scale;
  const bx = (256 + 90 * vScale) * scale;
  const by = (256 - 96 * vScale) * scale;
  const cx = 256 * scale;
  const cy = (256 + 96 * vScale) * scale;

  for (let sy of subOffsets) {
    for (let sx of subOffsets) {
      const px = x + sx;
      const py = y + sy;

      // 1. Background
      let bgAlpha = 0;
      if (isMaskable) {
        bgAlpha = 1.0;
      } else {
        const bgDist = distToRoundedRect(px, py, width, height, width * 0.22);
        bgAlpha = Math.max(0, Math.min(1, 0.5 - bgDist));
      }

      if (bgAlpha <= 0) continue;

      // Subtle radial dark gradient
      const distFromCenter = Math.hypot(px - width / 2, py - height * 0.38) / (width * 0.65);
      const bgR = Math.max(12, Math.round(26 - distFromCenter * 14));
      const bgG = Math.max(13, Math.round(28 - distFromCenter * 15));
      const bgB = Math.max(18, Math.round(36 - distFromCenter * 18));

      // Border highlight inside squircle
      let borderGlow = 0;
      if (!isMaskable) {
        const bgDist = distToRoundedRect(px, py, width, height, width * 0.22);
        if (bgDist < 0 && bgDist > -1.8) {
          borderGlow = Math.max(0, 1 - Math.abs(bgDist + 0.9)) * 0.16;
        }
      }

      // 2. Letter "V" SDF
      const d1 = distToSegment(px, py, ax, ay, cx, cy);
      const d2 = distToSegment(px, py, bx, by, cx, cy);
      const dV = Math.min(d1, d2);

      // Distance to V stroke
      const vDist = dV - strokeRadius;
      const vAlpha = Math.max(0, Math.min(1, 0.5 - vDist));

      // Color of V: subtle clean white-to-light-silver gradient
      const vGradT = Math.max(0, Math.min(1, (py - ay) / (cy - ay)));
      const vColorR = 255 - vGradT * 18;
      const vColorG = 255 - vGradT * 14;
      const vColorB = 255 - vGradT * 10;

      // Blend V over Background
      let finalR = bgR + borderGlow * 255;
      let finalG = bgG + borderGlow * 255;
      let finalB = bgB + borderGlow * 255;
      let finalA = bgAlpha * 255;

      if (vAlpha > 0) {
        finalR = finalR * (1 - vAlpha) + vColorR * vAlpha;
        finalG = finalG * (1 - vAlpha) + vColorG * vAlpha;
        finalB = finalB * (1 - vAlpha) + vColorB * vAlpha;
      }

      totalR += finalR;
      totalG += finalG;
      totalB += finalB;
      totalA += finalA;
    }
  }

  return [totalR / 4, totalG / 4, totalB / 4, totalA / 4];
}

// --- Create ICO file (containing 16x16, 32x32, 48x48 PNGs) ---
function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // image type (1 = icon)
  header.writeUInt16LE(count, 4); // image count

  let offset = 6 + count * 16;
  const directoryEntries = [];
  const imageBodies = [];

  for (const { width, height, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2); // color palette (0 = no palette)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // image offset

    directoryEntries.push(entry);
    imageBodies.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...directoryEntries, ...imageBodies]);
}

// Generate all files
console.log('Generating VozDesk logo formats...');

// 1. PWA 512x512
const pwa512 = createPng(512, 512, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);
console.log('Created pwa-512x512.png');

// 2. PWA 192x192
const pwa192 = createPng(192, 192, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);
console.log('Created pwa-192x192.png');

// 3. Apple Touch Icon 180x180
const appleTouch = createPng(180, 180, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);
console.log('Created apple-touch-icon.png');

// 4. Maskable Icon 512x512 (Safe-zone full-bleed background for Android)
const maskable512 = createPng(512, 512, (x, y, w, h) => renderLogoPixel(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'maskable-icon-512x512.png'), maskable512);
console.log('Created maskable-icon-512x512.png');

// 5. Favicon ICO (16x16, 32x32, 48x48)
const ico16 = createPng(16, 16, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));
const ico32 = createPng(32, 32, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));
const ico48 = createPng(48, 48, (x, y, w, h) => renderLogoPixel(x, y, w, h, false));
const icoBuffer = createIco([
  { width: 16, height: 16, buffer: ico16 },
  { width: 32, height: 32, buffer: ico32 },
  { width: 48, height: 48, buffer: ico48 },
]);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
console.log('Created favicon.ico');

console.log('All image formats generated successfully!');
