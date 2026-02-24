import { MaterialCommunityIcons } from "@expo/vector-icons";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { PrayerTime } from "../../services/prayerTimes";

const PRAYER_ICONS: Record<string, string> = {
  Fajr: "moon-waning-crescent",
  Sunrise: "weather-sunset-up",
  Dhuhr: "white-balance-sunny",
  Asr: "clock-outline",
  Maghrib: "weather-sunset-down",
  Isha: "weather-night",
};

type GeneratedStyles = ReturnType<typeof createStyles>;
type GeneratedRowStyles = ReturnType<typeof createRowStyles>;
type ThemeColors = AppTheme["colors"];

/* ---------- Pure JS shimmer bar (no gradient libs) ---------- */
/* Uses a moving highlight made of layered translucent views with skew and opacity */
function SkeletonBar({
  style,
  height = 20,
  progress, // shared Animated.Value from parent (optional)
  styles,
  themeColors,
}: {
  style?: StyleProp<ViewStyle>;
  height?: number;
  progress?: Animated.Value;
  styles: GeneratedStyles;
  themeColors: ThemeColors;
}) {
  const [w, setW] = useState(0);
  const localProgress = useRef(new Animated.Value(0)).current;
  const driver = progress ?? localProgress;

  useEffect(() => {
    if (progress) return; // parent controls the loop
    const loop = Animated.loop(
      Animated.timing(localProgress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, localProgress]);

  const onLayout = (e: LayoutChangeEvent) => {
    setW(e.nativeEvent.layout.width || 0);
  };

  const highlightW = Math.max(80, Math.floor(w * 0.35));
  const translateX = useMemo(() => {
    return driver.interpolate({
      inputRange: [0, 1],
      outputRange: [-highlightW, w + highlightW],
    });
  }, [driver, w, highlightW]);

  return (
    <View
      onLayout={onLayout}
      style={[styles.skeletonBarBase, { height }, style]}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: highlightW,
          transform: [{ translateX }, { skewX: "15deg" }],
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "100%",
            backgroundColor: withOpacity(themeColors.accent, 0.12),
            borderRadius: 6,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: "20%",
            top: 0,
            bottom: 0,
            width: "60%",
            backgroundColor: withOpacity(themeColors.white, 0.25),
            borderRadius: 6,
          }}
        />
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "35%",
            backgroundColor: withOpacity(themeColors.accent, 0.18),
            borderRadius: 6,
          }}
        />
      </Animated.View>
    </View>
  );
}

/* ---------- One skeleton row that matches real row footprint exactly ---------- */
function PrayerRowSkeleton({
  progress,
  rowStyles,
  styles,
  themeColors,
}: {
  progress?: Animated.Value;
  rowStyles: GeneratedRowStyles;
  styles: GeneratedStyles;
  themeColors: ThemeColors;
}) {
  return (
    <View
      style={[
        rowStyles.containerBase,
        {
          backgroundColor: "transparent",
          borderColor: "transparent",
        },
      ]}
    >
      <View style={styles.leftCluster}>
        <SkeletonBar
          style={styles.skeletonIcon}
          height={22}
          progress={progress}
          styles={styles}
          themeColors={themeColors}
        />
        <SkeletonBar
          style={{ width: 96 }}
          height={18}
          progress={progress}
          styles={styles}
          themeColors={themeColors}
        />
      </View>
      <SkeletonBar
        style={styles.skeletonTime}
        height={18}
        progress={progress}
        styles={styles}
        themeColors={themeColors}
      />
    </View>
  );
}

/* ---------- Skeleton list with shared animation for smoothness and efficiency ---------- */
function PrayerTimesSkeletonList({
  rows = 6,
  rowStyles,
  styles,
  themeColors,
}: {
  rows?: number;
  rowStyles: GeneratedRowStyles;
  styles: GeneratedStyles;
  themeColors: ThemeColors;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <PrayerRowSkeleton
          key={i}
          progress={progress}
          rowStyles={rowStyles}
          styles={styles}
          themeColors={themeColors}
        />
      ))}
    </View>
  );
}

/* ---------- Main list ---------- */
export default function PrayerTimesList({
  loading,
  prayerTimes,
  timeOpacity,
  timeSlide,
}: {
  loading: boolean;
  prayerTimes: PrayerTime[];
  timeOpacity?: Animated.Value;
  timeSlide?: Animated.Value;
}) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rowStyles = useMemo(() => createRowStyles(theme), [theme]);

  if (loading) {
    return (
      <PrayerTimesSkeletonList
        rows={6}
        rowStyles={rowStyles}
        styles={styles}
        themeColors={themeColors}
      />
    );
  }

  return (
    <View>
      {prayerTimes.map(({ label, time }) => {
        const iconName = PRAYER_ICONS[label] ?? "time-outline";

        return (
          <View
            key={label}
            style={[rowStyles.containerBase, styles.rowSurface]}
          >
            <View style={styles.leftCluster}>
              <View style={styles.rowIconWrap}>
                <MaterialCommunityIcons
                  name={iconName as any}
                  size={14}
                  color={withOpacity(themeColors.accent, 0.92)}
                />
              </View>
              <Text style={[rowStyles.labelText, styles.labelSpacing]}>{label}</Text>
            </View>

            <Animated.Text
              style={[
                rowStyles.timeText,
                timeOpacity && timeSlide
                  ? {
                      opacity: timeOpacity,
                      transform: [{ translateX: timeSlide }],
                    }
                  : {},
              ]}
            >
              {time}
            </Animated.Text>
          </View>
        );
      })}
    </View>
  );
}

const createRowStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;

  return {
    containerBase: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      borderRadius: 14,
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 10,
      borderWidth: 1,
    },
    labelText: {
      color: withOpacity(themeColors.white, 0.9),
      fontSize: 17,
      fontFamily: "SFProDisplay-Semibold",
      letterSpacing: 0.2,
    },
    timeText: {
      color: themeColors.accent,
      fontSize: 17,
      fontFamily: "SFProDisplay-Bold",
      letterSpacing: 0.2,
    },
  };
};

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    rowSurface: {
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurfaceAlt, 0.3)
        : withOpacity(themeColors.white, 0.05),
      borderColor: isLight
        ? withOpacity(themeColors.accent, 0.35)
        : withOpacity(themeColors.white, 0.1),
      shadowColor: themeColors.primaryDark,
      shadowOpacity: isLight ? 0.22 : 0.2,
      shadowRadius: isLight ? 20 : 18,
      shadowOffset: { width: 0, height: isLight ? 10 : 8 },
      elevation: 4,
      overflow: "hidden",
    },
    leftCluster: {
      flexDirection: "row",
      alignItems: "center",
    },
    labelSpacing: {
      marginLeft: 10,
    },
    rowIconWrap: {
      width: 24,
      height: 24,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(themeColors.accent, 0.12),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.28),
    },
    skeletonIcon: {
      width: 22,
      borderRadius: 999,
    },
    skeletonTime: {
      width: 88,
      borderRadius: 999,
    },
    skeletonBarBase: {
      backgroundColor: withOpacity(themeColors.white, 0.08),
      borderRadius: 6,
      overflow: "hidden",
    },
  });
};
