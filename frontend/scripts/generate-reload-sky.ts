/**
 * Bakes the splash sky's backdrop (gradient + vignette, no stars or text) into
 * one PNG per theme for the native OTA reload screen, which can only show a
 * solid color or an image. Re-run after changing the sky colors in
 * constants/theme.ts or components/splash/skyBackdrop.ts:
 *
 *   npx tsx scripts/generate-reload-sky.ts
 *
 * The images are a thin vertical strip; the reload screen stretches them to
 * the full screen, so every row lands at the same height fraction the live
 * gradient draws it at, on any device. __tests__/splash/reloadSky.test.ts fails
 * if the committed PNGs drift from the theme.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

import { skyBackdrop, skyColorAt } from "../components/splash/skyBackdrop";
import { themeMap, type ThemeName } from "../constants/theme";

const RELOAD_SKY_WIDTH = 4;
const RELOAD_SKY_HEIGHT = 1024;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rowColor: (y: number) => number[]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rgb = rowColor(y);
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < width; x++) raw.set(rgb, y * stride + 1 + x * 3);
  }
  // sRGB chunk (perceptual) so iOS reads the values the same way it reads the
  // app's hex colors.
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("sRGB", Buffer.from([0])),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = join(__dirname, "..", "assets", "reload");
mkdirSync(outDir, { recursive: true });

for (const name of Object.keys(themeMap) as ThemeName[]) {
  const backdrop = skyBackdrop(themeMap[name]);
  const png = encodePng(RELOAD_SKY_WIDTH, RELOAD_SKY_HEIGHT, (y) =>
    // Sample at the row's centre, which is where a stretch maps it.
    skyColorAt(backdrop, (y + 0.5) / RELOAD_SKY_HEIGHT).map((v) => Math.round(v)),
  );
  writeFileSync(join(outDir, `sky-${name}.png`), png);
  console.log(`assets/reload/sky-${name}.png (${png.length} bytes)`);
}
