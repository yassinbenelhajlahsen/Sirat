import type { AppTheme } from "@/constants/theme";

/**
 * The splash sky's backdrop with nothing on it: the vertical gradient and, on the
 * dark themes, the vignette across the top. One description feeds the live
 * gradient (`SkyGradient` in SplashSky) and the reload-screen PNGs in
 * `assets/reload/`, so the native screen shown while an OTA update loads is the
 * same sky the splash then draws its stars and text onto.
 */
export type SkyBackdrop = {
  colors: [string, string, string];
  locations: [number, number, number];
  /** Opaque color fading from `alpha` at the top to clear at `VIGNETTE_HEIGHT`. */
  vignette: { color: string; alpha: number } | null;
};

/** Share of the screen height the top vignette covers. */
export const VIGNETTE_HEIGHT = 0.4;

export function skyBackdrop(theme: Pick<AppTheme, "name" | "colors">): SkyBackdrop {
  const { colors } = theme;
  if (theme.name === "light") {
    return {
      colors: [colors.primaryLift, colors.primary, colors.primaryDeep],
      locations: [0, 0.5, 1],
      vignette: null,
    };
  }
  return {
    colors: [colors.primaryDark, colors.primaryDeep, colors.primaryLift],
    locations: [0, 0.4, 1],
    vignette: { color: colors.black, alpha: 0.5 },
  };
}

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The backdrop's color `t` of the way down the screen (0 = top, 1 = bottom), as
 * 0–255 channel values. Interpolates in sRGB like the native gradient does.
 */
export function skyColorAt(backdrop: SkyBackdrop, t: number): RGB {
  const { colors, locations, vignette } = backdrop;
  const y = Math.min(1, Math.max(0, t));
  const seg = y <= locations[1] ? 0 : 1;
  const span = locations[seg + 1] - locations[seg];
  const local = span > 0 ? (y - locations[seg]) / span : 0;
  const from = hexToRgb(colors[seg]);
  const to = hexToRgb(colors[seg + 1]);
  let rgb: RGB = [mix(from[0], to[0], local), mix(from[1], to[1], local), mix(from[2], to[2], local)];

  if (vignette && y < VIGNETTE_HEIGHT) {
    const a = vignette.alpha * (1 - y / VIGNETTE_HEIGHT);
    const v = hexToRgb(vignette.color);
    rgb = [mix(rgb[0], v[0], a), mix(rgb[1], v[1], a), mix(rgb[2], v[2], a)];
  }
  return rgb;
}
