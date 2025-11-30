import { colors as themeColors, withOpacity } from "@/app/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
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

/* ---------- Shared row styles (used by both skeleton and real rows) ---------- */
const ROW_STYLES = {
  containerBase: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  labelText: {
    color: withOpacity(themeColors.white, 0.9),
    fontSize: 20,
    fontFamily: "SFProDisplay-Semibold",
    letterSpacing: 0.2,
  },
  timeText: {
    color: themeColors.accent,
    fontSize: 20,
    fontFamily: "SFProDisplay-Bold",
    letterSpacing: 0.2,
  },
};

/* ---------- Pure JS shimmer bar (no gradient libs) ---------- */
/* Uses a moving highlight made of layered translucent views with skew and opacity */
function SkeletonBar({
  style,
  height = 20,
  progress, // shared Animated.Value from parent (optional)
}: {
  style?: StyleProp<ViewStyle>;
  height?: number;
  progress?: Animated.Value;
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
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, localProgress]);

  const onLayout = (e: LayoutChangeEvent) => {
    setW(e.nativeEvent.layout.width || 0);
  };

  // Width of the moving highlight (soft “glow”). Scale with container width.
  const highlightW = Math.max(80, Math.floor(w * 0.35));
  const translateX = useMemo(() => {
    return driver.interpolate({
      inputRange: [0, 1],
      outputRange: [-highlightW, w + highlightW], // start offscreen, end offscreen
    });
    // re-compute if width changes
  }, [driver, w, highlightW]);

  return (
    <View
      onLayout={onLayout}
      style={[styles.skeletonBarBase, { height }, style]}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      {/* Moving highlight: composed of 3 layers to fake a gradient */}
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
        {/* soft edges */}
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
        {/* brighter center strip */}
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
        {/* subtle trailing edge for depth */}
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
function PrayerRowSkeleton({ progress }: { progress?: Animated.Value }) {
  return (
    <View
      style={[
        ROW_STYLES.containerBase,
        {
          backgroundColor: "transparent",
          borderColor: "transparent", // width remains 2 to prevent jump
        },
      ]}
    >
      {/* label placeholder */}
      <SkeletonBar style={{ width: 96 }} height={20} progress={progress} />
      {/* time placeholder */}
      <SkeletonBar style={{ width: 72 }} height={20} progress={progress} />
    </View>
  );
}

/* ---------- Skeleton list with shared animation for smoothness and efficiency ---------- */
function PrayerTimesSkeletonList({ rows = 6 }: { rows?: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <PrayerRowSkeleton key={i} progress={progress} />
      ))}
    </View>
  );
}

/* ---------- Main list ---------- */
export default function PrayerTimesList({
  loading,
  prayerTimes,
  nextPrayerLabel,
}: {
  loading: boolean;
  prayerTimes: PrayerTime[];
  nextPrayerLabel?: string | null;
}) {
  if (loading) {
    return <PrayerTimesSkeletonList rows={6} />;
  }

  return (
    <View>
      {prayerTimes.map(({ label, time }) => {
        const isNext = nextPrayerLabel === label;
        if (isNext) {
          return (
            <LinearGradient
              key={label}
              colors={[
                withOpacity(themeColors.accent, 0.9),
                themeColors.primaryHighlight,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[ROW_STYLES.containerBase, styles.nextRowCard]}
            >
              <Text style={[ROW_STYLES.labelText, styles.nextRowLabel]}>
                {label}
              </Text>
              <Text style={[ROW_STYLES.timeText, styles.nextRowTime]}>
                {time}
              </Text>
            </LinearGradient>
          );
        }

        return (
          <View
            key={label}
            style={[ROW_STYLES.containerBase, styles.rowSurface]}
          >
            <Text style={ROW_STYLES.labelText}>{label}</Text>
            <Text style={ROW_STYLES.timeText}>{time}</Text>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  rowSurface: {
    backgroundColor: withOpacity(themeColors.white, 0.05),
    borderColor: withOpacity(themeColors.white, 0.05),
    shadowColor: withOpacity(themeColors.black, 0.05),
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    overflow: "hidden",
  },
  nextRowCard: {
    borderColor: withOpacity(themeColors.accent, 0.8),
    shadowColor: withOpacity(themeColors.accent, 0.8),
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 7,
    overflow: "hidden",
  },
  nextRowLabel: {
    color: themeColors.white,
    textShadowColor: withOpacity(themeColors.primaryDeep, 0.35),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  nextRowTime: {
    color: themeColors.white,
    textShadowColor: withOpacity(themeColors.primaryDeep, 0.35),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  skeletonBarBase: {
    backgroundColor: withOpacity(themeColors.white, 0.08),
    borderRadius: 6,
    overflow: "hidden",
  },
});
