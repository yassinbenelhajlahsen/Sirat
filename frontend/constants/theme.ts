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
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const typography = {
  caption: 12,
  body: 14,
  bodyLg: 16,
  subtitle: 18,
  title: 22,
  display: 36,
} as const;

export type AppTheme = {
  name: ThemeName;
  colors: AppColors;
  spacing: typeof spacing;
  typography: typeof typography;
};

const ACCENT_COLORS = {
  accent: "#DABA69",
  accentGlow: "#00ffcc",
  accentSoft: "#d4e7d2",
  accentMuted: "#dfeee0",
  onAccent: "#0f1f16",
  successSoft: "#C8E6C9",
  danger: "#ff7070",
} as const;

const defaultColors: AppColors = {
  primary: "#134b0a",
  primarySurface: "#1a5f0e",
  primarySurfaceAlt: "#1e5c1a",
  primaryMuted: "#184d1a",
  primaryHighlight: "#1b5e11",
  primaryBorder: "#1b4e10",
  primaryOutline: "#235e1d",
  primaryDark: "#0c3605",
  primaryDeep: "#0f1f16",
  primaryLift: "#2a7520",
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
  accent: "#B8943F",
  accentGlow: "#B8943F",
  accentSoft: "#E2CEB1",
  accentMuted: "#F0E5D4",
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
  name: "default",
  colors: defaultColors,
  spacing,
  typography,
};

export const darkTheme: AppTheme = {
  name: "dark",
  colors: darkColors,
  spacing,
  typography,
};

export const lightTheme: AppTheme = {
  name: "light",
  colors: lightColors,
  spacing,
  typography,
};

export const themeMap: Record<ThemeName, AppTheme> = {
  default: defaultTheme,
  dark: darkTheme,
  light: lightTheme,
};

export const isThemeName = (value: string | null | undefined): value is ThemeName =>
  value === "default" || value === "dark" || value === "light";

export const withOpacity = (hexColor: string, alpha: number): string => {
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
};
