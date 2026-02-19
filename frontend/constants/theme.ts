export const colors = {
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
  accent: "#DABA69",
  accentGlow: "#00ffcc",
  accentSoft: "#d4e7d2",
  accentMuted: "#dfeee0",
  successSoft: "#C8E6C9",
  white: "#ffffff",
  offWhite: "#f4f3f4",
  black: "#000000",
  grayLight: "#cfcfcf",
  grayMedium: "#aaa",
  grayMuted: "#888",
  grayDark: "#555",
  danger: "#ff7070",
} as const;

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

export const theme = {
  colors,
  spacing,
  typography,
  withOpacity,
} as const;
