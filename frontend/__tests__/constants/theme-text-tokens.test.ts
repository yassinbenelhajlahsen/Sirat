import { darkTheme, defaultTheme, lightTheme, themeMap } from "@/constants/theme";

// WCAG relative luminance + contrast ratio, computed on the blended colour a
// translucent foreground produces over an opaque canvas.
function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]: number[]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function parse(color: string): { rgb: number[]; a: number } {
  const rgba = color.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  if (rgba) {
    return { rgb: [+rgba[1], +rgba[2], +rgba[3]], a: +rgba[4] };
  }
  const hex = color.replace("#", "");
  const n = parseInt(hex.length === 3 ? hex.split("").map((h) => h + h).join("") : hex, 16);
  return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
}
function blend(fg: string, bg: string) {
  const f = parse(fg);
  const b = parse(bg);
  return f.rgb.map((c, i) => Math.round(c * f.a + b.rgb[i] * (1 - f.a)));
}
function contrast(fg: string, bg: string) {
  const l1 = luminance(blend(fg, bg));
  const l2 = luminance(parse(bg).rgb);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe("semantic text tokens", () => {
  it.each(Object.values(themeMap))("$name defines every token", (theme) => {
    const { colors } = theme;
    for (const key of ["textPrimary", "textSecondary", "textTertiary", "textDisabled", "iconMuted"] as const) {
      expect(typeof colors[key]).toBe("string");
      expect(colors[key].length).toBeGreaterThan(0);
    }
  });

  it.each([defaultTheme, darkTheme, lightTheme])(
    "$name secondary and tertiary text clear 4.5:1 on the primary canvas",
    (theme) => {
      const canvas = theme.colors.primary;
      expect(contrast(theme.colors.textSecondary, canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.colors.textTertiary, canvas)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([defaultTheme, darkTheme, lightTheme])(
    "$name muted icons clear 3:1 on the primary canvas",
    (theme) => {
      expect(contrast(theme.colors.iconMuted, theme.colors.primary)).toBeGreaterThanOrEqual(3);
    },
  );
});
