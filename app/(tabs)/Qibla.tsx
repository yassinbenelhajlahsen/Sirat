// screens/Qibla.tsx
import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import useQibla from "../util/useQibla";

function minimalTarget(from: number, to: number) {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta; // continuous, unbounded
}

const arrowImg =
  require("../../assets/images/qibla-compass-svgrepo-com.png") as ImageSourcePropType;

export default function Qibla() {
  const { rotation, error, accuracy, isAligned } = useQibla();

  // Reanimated shared value for unbounded rotation (no snapping)
  const rot = useSharedValue(0);
  const lastHapticAt = useRef(0);
  const prevAligned = useRef(false);

  // Drive the arrow with a native spring on each update
  useEffect(() => {
    if (rotation == null) return;
    const target = minimalTarget(rot.get(), rotation);
    rot.value = withSpring(target, { stiffness: 180, damping: 20, mass: 0.9 });
  }, [rotation]);

  // Haptic once when entering aligned state
  useEffect(() => {
    const now = Date.now();
    if (isAligned && !prevAligned.current && now - lastHapticAt.current > 900) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastHapticAt.current = now;
    }
    prevAligned.current = isAligned;
  }, [isAligned]);

  const animatedStyle = useAnimatedStyle(() => {
    // Convert unbounded degrees to CSS rotate
    const deg = rot.value % 360;
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const needsCal = accuracy != null && accuracy > 20;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Qibla</Text>
        {accuracy != null && accuracy >= 0 ? (
          <Text style={styles.subtle}>Accuracy ±{Math.round(accuracy)}°</Text>
        ) : null}
      </View>

      <View style={styles.center}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : rotation == null ? (
          <Text style={styles.loadingText}>Finding direction…</Text>
        ) : (
          <>
            {needsCal ? (
              <Text style={styles.noteText}>
                Move phone in a figure eight to improve accuracy.
              </Text>
            ) : null}

            <View style={[styles.ring, isAligned && styles.ringAligned]}>
              <Animated.Image
                source={arrowImg}
                style={[styles.arrow, animatedStyle]}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.helper}>
              Haptic click means you’re aligned.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#134b0a" },
  titleContainer: { paddingTop: 10, paddingHorizontal: 20 },
  title: {
    color: "white",
    fontFamily: "SFProDisplay-Bold",
    fontSize: 44,
    letterSpacing: 0.2,
  },
  subtle: { marginTop: 2, color: "#d4e7d2", fontSize: 13 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  // Keep shadows light; heavy blur can hurt FPS during transforms
  ring: {
    width: 320,
    height: 320,
    borderRadius: 160,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    shadowColor: "#00ffcc",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  ringAligned: {
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  arrow: { width: 280, height: 280 },

  loadingText: { color: "white", fontSize: 18 },
  errorText: { color: "#ff7070", fontSize: 16, textAlign: "center" },
  noteText: {
    color: "#DABA69",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  helper: {
    color: "#dfeee0",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
});
