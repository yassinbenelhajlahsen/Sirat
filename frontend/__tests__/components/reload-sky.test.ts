import { readFileSync } from "fs";
import { join } from "path";
import { inflateSync } from "zlib";

import { skyBackdrop, skyColorAt, VIGNETTE_HEIGHT } from "@/components/splash/skyBackdrop";
import { themeMap, type ThemeName } from "@/constants/theme";

// Minimal reader for the PNGs scripts/generate-reload-sky.ts writes:
// 8-bit RGB, filter 0 on every row.
function readPng(path: string) {
  const buf = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(2);
    } else if (type === "IDAT") idat.push(data);
    offset += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = 1 + width * 3;
  const row = (y: number) => {
    expect(raw[y * stride]).toBe(0);
    const i = y * stride + 1;
    return [raw[i], raw[i + 1], raw[i + 2]];
  };
  return { width, height, row };
}

describe("OTA reload sky images", () => {
  it.each(Object.keys(themeMap) as ThemeName[])(
    "sky-%s.png matches the splash backdrop (re-run scripts/generate-reload-sky.ts if this fails)",
    (name) => {
      const png = readPng(join(__dirname, "../../assets/reload", `sky-${name}.png`));
      const backdrop = skyBackdrop(themeMap[name]);
      expect(png.height).toBeGreaterThanOrEqual(512);
      for (let y = 0; y < png.height; y++) {
        const expected = skyColorAt(backdrop, (y + 0.5) / png.height);
        png.row(y).forEach((v, c) => expect(Math.abs(v - expected[c])).toBeLessThanOrEqual(1));
      }
    },
  );

  it("follows the gradient stops and the dark themes' top vignette", () => {
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const dark = themeMap.dark;
    const b = skyBackdrop(dark);
    expect(skyColorAt(b, 1)).toEqual(hex(dark.colors.primaryLift));
    // Below the vignette the 0.4 stop is the plain primaryDeep.
    expect(VIGNETTE_HEIGHT).toBe(0.4);
    expect(skyColorAt(b, 0.4)).toEqual(hex(dark.colors.primaryDeep));
    // At the very top, primaryDark half-covered by the black vignette.
    const top = skyColorAt(b, 0);
    hex(dark.colors.primaryDark).forEach((v, c) =>
      expect(top[c]).toBeCloseTo((v + hex(dark.colors.black)[c]) / 2, 5),
    );

    const light = themeMap.light;
    expect(skyBackdrop(light).vignette).toBeNull();
    expect(skyColorAt(skyBackdrop(light), 0)).toEqual(hex(light.colors.primaryLift));
  });
});
