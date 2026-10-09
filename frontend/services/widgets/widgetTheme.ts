import { isThemeName, themeMap, type ThemeName } from "@/constants/theme";

// The widget runtime cannot read the theme, so the app sends the three colors
// every layout needs. Dimmer text is the same color at lower opacity.
export type WidgetTheme = { background: string; text: string; accent: string };

export function widgetTheme(name: string | null | undefined): WidgetTheme {
  const resolved: ThemeName = isThemeName(name) ? name : "default";
  const { colors } = themeMap[resolved];
  return { background: colors.primary, text: colors.textPrimary, accent: colors.accent };
}
