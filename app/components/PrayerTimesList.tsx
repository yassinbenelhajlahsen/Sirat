import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Text,
  View,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
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
    // Keep borderWidth constant so nothing jumps when data renders
    borderWidth: 2,
  },
  labelText: { color: "white", fontSize: 20 },
  timeText: { color: "white", fontSize: 20 },
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
      style={[
        {
          height,
          backgroundColor: "#184d1a", // base bar color
          borderRadius: 6,
          overflow: "hidden",
        },
        style,
      ]}
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
            backgroundColor: "rgba(255,255,255,0.10)",
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
            backgroundColor: "rgba(255,255,255,0.25)",
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
            backgroundColor: "rgba(255,255,255,0.12)",
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
        return (
          <View
            key={label}
            style={[
              ROW_STYLES.containerBase,
              {
                backgroundColor: isNext ? "#1b5e11" : "transparent",
                borderColor: isNext ? "#DABA69" : "transparent", // width stays 2
              },
            ]}
          >
            <Text style={ROW_STYLES.labelText}>{label}</Text>
            <Text style={ROW_STYLES.timeText}>{time}</Text>
          </View>
        );
      })}
    </View>
  );
}
