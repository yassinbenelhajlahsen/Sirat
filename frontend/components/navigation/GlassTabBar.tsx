import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassSurface from "@/components/ui/GlassSurface";
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { expandTabBar, tabBarCollapse } from "@/utils/tabBarChrome";

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: { on: "home", off: "home-outline", label: "Home" },
  Quran: { on: "book", off: "book-outline", label: "Quran" },
  Qibla: { on: "compass", off: "compass-outline", label: "Qibla" },
  Mosques: { on: "location", off: "location-outline", label: "Mosques" },
  Calendar: { on: "today", off: "today-outline", label: "Calendar" },
};

const H_MARGIN = 14;
const PAD = 8;

export default function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();
  const { width } = useWindowDimensions();

  const tabs = state.routes.filter((r) => ICONS[r.name]);
  const count = tabs.length || 1;
  const pillWidth = Math.max(0, width - H_MARGIN * 2);
  const slot = (pillWidth - PAD * 2) / count;
  const indicatorW = Math.max(0, slot - 8);

  const activeKey = state.routes[state.index]?.key;
  const activeIdx = Math.max(0, tabs.findIndex((r) => r.key === activeKey));

  const translateX = useRef(new Animated.Value(activeIdx * slot)).current;
  useEffect(() => {
    Animated.spring(translateX, {
      toValue: activeIdx * slot,
      useNativeDriver: true, // translateX is native-thread safe
      speed: 16,
      bounciness: 8,
    }).start();
  }, [activeIdx, slot, translateX]);

  // Reset to full size whenever the active tab changes, so each tab opens expanded.
  useEffect(() => {
    expandTabBar();
  }, [activeIdx]);

  const collapseScale = tabBarCollapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] });
  const collapseShiftY = tabBarCollapse.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 14) + 6 }]} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ scale: collapseScale }, { translateY: collapseShiftY }] }}>
        <GlassSurface tier="chrome" radius={theme.radii.pill} style={[styles.pill, { paddingHorizontal: PAD }]}>
          {/* Smoked-glass scrim: darkens the chrome so it reads as chrome, not content. */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: withOpacity(colors.primaryDeep, 0.5) }]}
          />
          {/* Fluid sliding glass-capsule indicator (translucent highlight over the glass pill). */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: indicatorW,
                left: PAD + (slot - indicatorW) / 2,
                borderRadius: theme.radii.pill,
                backgroundColor: withOpacity(colors.white, 0.22),
                borderColor: withOpacity(colors.white, 0.3),
                transform: [{ translateX }],
              },
            ]}
          />
          {tabs.map((route, i) => {
            const meta = ICONS[route.name];
            const focused = i === activeIdx;
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
                style={[styles.item, { width: slot }]}
              >
                <View style={{ transform: [{ scale: focused ? 1.12 : 1 }] }}>
                  <Ionicons name={focused ? meta.on : meta.off} size={22} color={focused ? colors.accent : withOpacity(colors.white, 0.55)} />
                </View>
              </Pressable>
            );
          })}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: H_MARGIN, right: H_MARGIN },
  pill: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  indicator: { position: "absolute", top: 7, bottom: 7, borderWidth: 1 },
  item: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
