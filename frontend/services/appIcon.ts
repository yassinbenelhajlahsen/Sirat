import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

import type { ThemeName } from "@/constants/theme";

/**
 * Bundled alternate-icon name for each in-app theme. `null` is the primary
 * (default green) icon. Names are PascalCase to match app.config.js — that is
 * what the native module registers and what setAlternateAppIcon expects.
 */
const THEME_ICON_NAME: Record<ThemeName, string | null> = {
  default: null,
  dark: "Dark",
  light: "Light",
};

type NativeIconsModule = {
  supportsAlternateIcons: boolean;
  getAppIconName: () => string | null;
  setAlternateAppIcon: (name: string | null) => Promise<string | null>;
};

/**
 * Probe the `ExpoAlternateAppIcons` native module without throwing.
 * `requireOptionalNativeModule` returns `null` when the native side isn't in
 * the running binary (Expo Go, or a dev client built before this plugin was
 * added), so the feature simply stays off instead of crashing the screen.
 * Importing the package's own wrapper would call the throwing
 * `requireNativeModule`, which is why we go through the optional probe here.
 */
function getNativeIcons(): NativeIconsModule | null {
  return requireOptionalNativeModule<NativeIconsModule>("ExpoAlternateAppIcons");
}

/** The bundled icon name a given theme maps to (`null` = primary icon). */
export function iconNameForTheme(themeName: ThemeName): string | null {
  return THEME_ICON_NAME[themeName];
}

/** Alternate app icons are an iOS-only capability and need a native build. */
export function alternateIconsSupported(): boolean {
  if (Platform.OS !== "ios") return false;
  const native = getNativeIcons();
  return !!native && native.supportsAlternateIcons === true;
}

/** Name of the icon currently shown on the home screen (`null` = primary). */
export function getActiveIconName(): string | null {
  const native = getNativeIcons();
  if (!native || !alternateIconsSupported()) return null;
  return native.getAppIconName();
}

/** Whether the live home-screen icon already matches the given theme. */
export function iconMatchesTheme(themeName: ThemeName): boolean {
  const native = getNativeIcons();
  if (!native || !alternateIconsSupported()) return true;
  return native.getAppIconName() === THEME_ICON_NAME[themeName];
}

/**
 * Switch the home-screen icon to match `themeName`. iOS shows its own
 * unavoidable confirmation alert when this runs, so only call it from an
 * explicit user action — never automatically on theme change. Resolves to
 * `true` when a change was issued, `false` when unsupported or already matching.
 */
export async function applyIconForTheme(themeName: ThemeName): Promise<boolean> {
  const native = getNativeIcons();
  if (!native || !alternateIconsSupported()) return false;

  const target = THEME_ICON_NAME[themeName];
  if (native.getAppIconName() === target) return false;

  // setAlternateAppIcon(null) resets to the primary icon.
  await native.setAlternateAppIcon(target);
  return true;
}
