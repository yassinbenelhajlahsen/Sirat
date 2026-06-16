import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassSurface from "@/components/ui/GlassSurface";
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

const HIDDEN = new Set(["Settings"]);

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: { on: "home", off: "home-outline", label: "Home" },
  Quran: { on: "book", off: "book-outline", label: "Quran" },
  Qibla: { on: "compass", off: "compass-outline", label: "Qibla" },
  Mosques: { on: "location", off: "location-outline", label: "Mosques" },
  Calendar: { on: "today", off: "today-outline", label: "Calendar" },
};

export default function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();

  const visible = state.routes.filter((r) => !HIDDEN.has(r.name));

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 14) + 6 }]} pointerEvents="box-none">
      <GlassSurface tier="chrome" radius={theme.radii.pill} style={styles.pill}>
        {visible.map((route) => {
          const meta = ICONS[route.name];
          if (!meta) return null;
          const activeIndex = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === activeIndex;

          const onPress = () => {
            haptic("selection");
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true } as any);
            if (!focused && !(event as any)?.defaultPrevented) navigation.navigate(route.name as never);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              onPress={onPress}
              style={styles.item}
            >
              <View style={[styles.bubble, focused && { backgroundColor: colors.accent }]}>
                <Ionicons
                  name={focused ? meta.on : meta.off}
                  size={22}
                  color={focused ? colors.onAccent : withOpacity(colors.white, 0.6)}
                />
              </View>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14 },
  pill: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  item: { alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44 },
  bubble: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
