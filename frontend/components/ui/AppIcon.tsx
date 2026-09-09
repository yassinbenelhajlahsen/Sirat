import { Ionicons } from "@expo/vector-icons";
import { SymbolView, type SymbolWeight } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

export type AppIconName = keyof typeof Ionicons.glyphMap;

/**
 * Ionicon name to SF Symbol. Call sites keep using Ionicon names (habit glyphs
 * are persisted by Ionicon name, so the fallback has to stay valid), and this
 * table upgrades them to the system set on iOS. Unmapped names fall through to
 * Ionicons on every platform.
 */
export const IONICON_TO_SF: Partial<Record<AppIconName, SFSymbol>> = {
  // Tabs
  home: "house.fill",
  "home-outline": "house",
  book: "book.fill",
  "book-outline": "book",
  compass: "safari.fill",
  "compass-outline": "safari",
  location: "mappin.and.ellipse",
  "location-outline": "mappin",
  today: "calendar",
  "today-outline": "calendar",
  // Chrome and navigation
  "settings-outline": "gearshape",
  "chevron-back": "chevron.left",
  "chevron-forward": "chevron.right",
  "chevron-down": "chevron.down",
  close: "xmark",
  "close-circle": "xmark.circle.fill",
  "close-circle-outline": "xmark.circle",
  "alert-circle": "exclamationmark.circle.fill",
  "warning-outline": "exclamationmark.triangle",
  refresh: "arrow.clockwise",
  "refresh-circle-outline": "arrow.counterclockwise.circle",
  add: "plus",
  checkmark: "checkmark",
  "checkmark-circle": "checkmark.circle.fill",
  "ellipse-outline": "circle",
  time: "clock.fill",
  "time-outline": "clock",
  search: "magnifyingglass",
  bookmark: "bookmark.fill",
  "bookmark-outline": "bookmark",
  "copy-outline": "doc.on.doc",
  "share-social-outline": "square.and.arrow.up",
  play: "play.fill",
  pause: "pause.fill",
  stop: "stop.fill",
  "cloud-offline-outline": "icloud.slash",
  "cloud-upload-outline": "icloud.and.arrow.up",
  locate: "location.fill",
  navigate: "arrow.triangle.turn.up.right.diamond.fill",
  "create-outline": "pencil",
  "archive-outline": "archivebox",
  "ellipsis-horizontal": "ellipsis",
  "trash-outline": "trash",
  "log-out-outline": "rectangle.portrait.and.arrow.right",
  "person-circle-outline": "person.crop.circle",
  "star-outline": "star",
  "mail-outline": "envelope",
  "shield-checkmark-outline": "checkmark.shield",
  "globe-outline": "globe",
  "phone-portrait-outline": "iphone",
  "business-outline": "building.2",
  notifications: "bell.fill",
  "notifications-outline": "bell",
  "notifications-off-outline": "bell.slash",
  "calendar-outline": "calendar",
  sparkles: "sparkles",
  "arrow-forward": "arrow.right",
  "arrow-up": "arrow.up",
  // Habit glyphs
  "moon-outline": "moon",
  "hand-left-outline": "hand.raised",
  "heart-outline": "heart",
  "sunny-outline": "sun.max",
  "water-outline": "drop",
  "walk-outline": "figure.walk",
  "cash-outline": "banknote",
  "people-outline": "person.2",
  "leaf-outline": "leaf",
};

export type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  /** `medium` for the tab bar, `regular` everywhere else. */
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export default function AppIcon({
  name,
  size = 20,
  color,
  weight = "regular",
  style,
  testID,
}: AppIconProps) {
  const symbol = IONICON_TO_SF[name];
  const fallback = <Ionicons name={name} size={size} color={color} />;

  if (Platform.OS !== "ios" || !symbol) return fallback;

  return (
    <SymbolView
      name={symbol}
      size={size}
      tintColor={color}
      weight={weight}
      fallback={fallback}
      style={style}
      testID={testID}
    />
  );
}
