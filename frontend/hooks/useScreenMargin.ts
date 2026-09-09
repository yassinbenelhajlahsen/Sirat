import { useWindowDimensions } from "react-native";

/** Width below which the screen margin tightens (iPhone mini / SE class). */
export const NARROW_WIDTH = 400;
export const SCREEN_MARGIN_NARROW = 16;
export const SCREEN_MARGIN_REGULAR = 20;

/**
 * The single horizontal margin every screen, the Quran header and the tab bar
 * read from, so content edges line up across the app.
 */
export function useScreenMargin(): number {
  const { width } = useWindowDimensions();
  return width < NARROW_WIDTH ? SCREEN_MARGIN_NARROW : SCREEN_MARGIN_REGULAR;
}

export default useScreenMargin;
