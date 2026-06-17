export const APP_THEME_STORAGE_KEY = "app_theme_v1";

export type ThemeName = "default" | "dark" | "light";

export type AppColors = {
  primary: string;
  primarySurface: string;
  primarySurfaceAlt: string;
  primaryMuted: string;
  primaryHighlight: string;
  primaryBorder: string;
  primaryOutline: string;
  primaryDark: string;
  primaryDeep: string;
  primaryLift: string;
  accent: string;
  accentGlow: string;
  accentSoft: string;
  accentMuted: string;
  accentSecondary: string;
  onAccent: string;
  successSoft: string;
  white: string;
  offWhite: string;
  black: string;
  grayLight: string;
  grayMedium: string;
  grayMuted: string;
  grayDark: string;
  danger: string;
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40,
} as const;

export const radii = {
  chip: 10, row: 14, card: 18, cardLg: 20, hero: 24, heroLg: 26, pill: 999,
} as const;

export const typography = {
  caption: 12,
  body: 14,
  bodyLg: 16,
  subtitle: 18,
  title: 22,
  display: 36,
} as const;

export type TypeStyleName =
  | "largeTitle" | "title1" | "title2" | "title3"
  | "headline" | "body" | "callout" | "subhead" | "footnote" | "caption";

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontFamily: "SFProDisplay-Regular" | "SFProDisplay-Semibold" | "SFProDisplay-Bold";
};

export const type: Record<TypeStyleName, TypeStyle> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontFamily: "SFProDisplay-Bold" },
  title1: { fontSize: 28, lineHeight: 34, fontFamily: "SFProDisplay-Bold" },
  title2: { fontSize: 22, lineHeight: 28, fontFamily: "SFProDisplay-Bold" },
  title3: { fontSize: 20, lineHeight: 25, fontFamily: "SFProDisplay-Semibold" },
  headline: { fontSize: 17, lineHeight: 22, fontFamily: "SFProDisplay-Semibold" },
  body: { fontSize: 17, lineHeight: 24, fontFamily: "SFProDisplay-Regular" },
  callout: { fontSize: 16, lineHeight: 21, fontFamily: "SFProDisplay-Regular" },
  subhead: { fontSize: 15, lineHeight: 20, fontFamily: "SFProDisplay-Regular" },
  footnote: { fontSize: 13, lineHeight: 18, fontFamily: "SFProDisplay-Regular" },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: "SFProDisplay-Regular" },
};

export function withOpacity(hexColor: string, alpha: number): string {
  const sanitized = hexColor.replace("#", "");
  const normalized =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => char + char)
          .join("")
      : sanitized.padEnd(6, "0");

  const numeric = parseInt(normalized, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;

  return `rgba(${red},${green},${blue},${alpha})`;
}

export type GlassTier = { fill: string; border: string; blur: number };
export type Materials = { chrome: GlassTier; card: GlassTier; row: GlassTier };

export function buildMaterials(colors: AppColors, isLight: boolean): Materials {
  // On dark themes glass is a light film; on light themes a dark tint.
  const tintBase = isLight ? colors.black : colors.white;
  return {
    chrome: { fill: withOpacity(tintBase, isLight ? 0.06 : 0.1), border: withOpacity(tintBase, isLight ? 0.1 : 0.18), blur: 26 },
    card:   { fill: withOpacity(tintBase, isLight ? 0.05 : 0.07), border: withOpacity(tintBase, isLight ? 0.08 : 0.13), blur: 18 },
    row:    { fill: withOpacity(tintBase, isLight ? 0.04 : 0.05), border: withOpacity(tintBase, isLight ? 0.07 : 0.09), blur: 0 },
  };
}

export type AuroraColors = { accent: string; secondary: string; core: string };

export type AppTheme = {
  name: ThemeName;
  colors: AppColors;
  spacing: typeof spacing;
  typography: typeof typography;
  type: typeof type;
  radii: typeof radii;
  materials: Materials;
  aurora: AuroraColors;
};

const ACCENT_COLORS = {
  accent: "#E8C77A",
  accentGlow: "#00ffcc",
  accentSoft: "#d4e7d2",
  accentMuted: "#dfeee0",
  accentSecondary: "#3FB984",
  onAccent: "#0f1f16",
  successSoft: "#C8E6C9",
  danger: "#ff7070",
} as const;

const defaultColors: AppColors = {
  primary: "#102A1C",
  primarySurface: "#1a5f0e",
  primarySurfaceAlt: "#1e5c1a",
  primaryMuted: "#184d1a",
  primaryHighlight: "#1b5e11",
  primaryBorder: "#1b4e10",
  primaryOutline: "#235e1d",
  primaryDark: "#0A150E",
  primaryDeep: "#0B1810",
  primaryLift: "#15402A",
  ...ACCENT_COLORS,
  white: "#ffffff",
  offWhite: "#f4f3f4",
  black: "#000000",
  grayLight: "#cfcfcf",
  grayMedium: "#aaa",
  grayMuted: "#888",
  grayDark: "#555",
};

const darkColors: AppColors = {
  primary: "#1A212D",
  primarySurface: "#1B2230",
  primarySurfaceAlt: "#232C3B",
  primaryMuted: "#293243",
  primaryHighlight: "#313D52",
  primaryBorder: "#2A3342",
  primaryOutline: "#3B465B",
  primaryDark: "#0E1117",
  primaryDeep: "#131926",
  primaryLift: "#273145",
  ...ACCENT_COLORS,
  accentSecondary: "#33D29B",
  white: "#F4F1E8",
  offWhite: "#CDC5B4",
  black: "#020305",
  grayLight: "#B8B09F",
  grayMedium: "#948B78",
  grayMuted: "#756C5A",
  grayDark: "#595143",
};

const lightColors: AppColors = {
  primary: "#F5EFE6",
  primarySurface: "#F5EFE6",
  primarySurfaceAlt: "#E2CEB1",
  primaryMuted: "#E2CEB1",
  primaryHighlight: "#FFFBF5",
  primaryBorder: "#CCB485",
  primaryOutline: "#B8943F",
  primaryDark: "#F5EFE6",
  primaryDeep: "#E2CEB1",
  primaryLift: "#FBF7F1",
  ...ACCENT_COLORS,
  accent: "#D4A94B",
  accentGlow: "#D4A94B",
  accentSoft: "#E2CEB1",
  accentMuted: "#F0E5D4",
  accentSecondary: "#2E7D5B",
  onAccent: "#1B1B1B",
  white: "#1B1B1B",
  offWhite: "#1C1A17",
  black: "#1C1A17",
  grayLight: "#7A756C",
  grayMedium: "#69645B",
  grayMuted: "#5E5A52",
  grayDark: "#4A463F",
};

export const defaultTheme: AppTheme = {
  name: "default", colors: defaultColors, spacing, typography, type, radii,
  materials: buildMaterials(defaultColors, false),
  aurora: { accent: defaultColors.accent, secondary: defaultColors.accentSecondary, core: defaultColors.accentGlow },
};
export const darkTheme: AppTheme = {
  name: "dark", colors: darkColors, spacing, typography, type, radii,
  materials: buildMaterials(darkColors, false),
  // Cool indigo + teal aurora — harmonises with the navy canvas; gold accent still pops.
  aurora: { accent: "#6E8BFF", secondary: darkColors.accentSecondary, core: "#8FA8FF" },
};
export const lightTheme: AppTheme = {
  name: "light", colors: lightColors, spacing, typography, type, radii,
  materials: buildMaterials(lightColors, true),
  aurora: { accent: lightColors.accent, secondary: lightColors.accentSecondary, core: lightColors.accentGlow },
};

export const themeMap: Record<ThemeName, AppTheme> = {
  default: defaultTheme,
  dark: darkTheme,
  light: lightTheme,
};

export const isThemeName = (value: string | null | undefined): value is ThemeName =>
  value === "default" || value === "dark" || value === "light";
