import { isThemeName, themeMap, type ThemeName } from "@/constants/theme";

// The widget runtime cannot read the theme, so the app sends the colors every
// layout needs. Dimmer text is the same color at lower opacity. Glows and the
// gradient are optional at render time: a layout can run before the first push.
export type WidgetTheme = {
  background: string;
  text: string;
  accent: string;
  // Diagonal backdrop, darkest to lightest, matching the app's screen gradient.
  gradient: [string, string, string];
  // The app's two soft corner glows (top right, bottom left).
  glow: string;
  glowSecondary: string;
};

export function widgetTheme(name: string | null | undefined): WidgetTheme {
  const resolved: ThemeName = isThemeName(name) ? name : "default";
  const { colors, aurora } = themeMap[resolved];
  return {
    background: colors.primary,
    text: colors.textPrimary,
    accent: colors.accent,
    gradient: [colors.primaryDeep, colors.primary, colors.primaryLift],
    glow: aurora.accent,
    glowSecondary: aurora.secondary,
  };
}
