import { themeMap, type ThemeName } from "@/constants/theme";
import { widgetTheme } from "@/services/widgets/widgetTheme";

describe("widgetTheme", () => {
  it.each(["default", "dark", "light"] as ThemeName[])(
    "takes the %s theme's own colors, background gradient and glows",
    (name) => {
      const { colors, aurora } = themeMap[name];
      expect(widgetTheme(name)).toEqual({
        background: colors.primary,
        text: colors.textPrimary,
        accent: colors.accent,
        gradient: [colors.primaryDeep, colors.primary, colors.primaryLift],
        glow: aurora.accent,
        glowSecondary: aurora.secondary,
      });
    },
  );

  it("falls back to the default theme for an unknown or missing name", () => {
    expect(widgetTheme("nope")).toEqual(widgetTheme("default"));
    expect(widgetTheme(null)).toEqual(widgetTheme("default"));
    expect(widgetTheme(undefined)).toEqual(widgetTheme("default"));
  });

  it("only uses 6-digit hex colors, so the widget can append an alpha pair", () => {
    for (const name of ["default", "dark", "light"] as ThemeName[]) {
      const t = widgetTheme(name);
      for (const c of [t.accent, t.glow, t.glowSecondary, t.text, ...t.gradient]) {
        expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});
