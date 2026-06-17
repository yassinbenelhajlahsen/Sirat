import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import ReAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Footnote, Title1, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

import type { CompassDialProps } from "./CompassDial.types";

const SIZE = 280;
const R = SIZE / 2;

// Unwrap a target angle so the spring takes the short way round (no 360 snap).
function minimalTarget(from: number, to: number) {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta;
}

function formatKm(km: number) {
  return Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function pointOnCircle(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: R + radius * Math.sin(rad), y: R - radius * Math.cos(rad) };
}

export default function CompassDial({
  heading,
  qiblaAngle,
  distanceKm,
  isAligned,
}: CompassDialProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // --- Reduce Motion ---
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // --- Dial rotation: rotate the whole card by -heading so N tracks true north ---
  const rot = useSharedValue(0);
  useEffect(() => {
    const target = minimalTarget(rot.get(), -heading);
    rot.value = reduceMotion
      ? target
      : withSpring(target, { stiffness: 180, damping: 20, mass: 0.9 });
  }, [heading, reduceMotion, rot]);
  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  // --- One-shot ripple on the aligned rising edge ---
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const prevAligned = useRef(false);
  useEffect(() => {
    if (isAligned && !prevAligned.current && !reduceMotion) {
      rippleScale.setValue(0.62);
      rippleOpacity.setValue(0.5);
      Animated.parallel([
        Animated.timing(rippleScale, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(rippleOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
    }
    prevAligned.current = isAligned;
  }, [isAligned, reduceMotion, rippleScale, rippleOpacity]);

  // --- Ticks (every 6°, major every 30°) ---
  const ticks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let a = 0; a < 360; a += 6) {
      const major = a % 30 === 0;
      const outer = pointOnCircle(a, R - 6);
      const inner = pointOnCircle(a, major ? R - 20 : R - 13);
      out.push({ x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y, major });
    }
    return out;
  }, []);

  const cardinals = useMemo(
    () => [
      { label: "N", angle: 0 },
      { label: "E", angle: 90 },
      { label: "S", angle: 180 },
      { label: "W", angle: 270 },
    ],
    [],
  );

  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel="Qibla compass">
      {/* aligned ripple (behind everything) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          { opacity: rippleOpacity, transform: [{ scale: rippleScale }] },
        ]}
      />

      {/* glass ring material */}
      <GlassSurface tier="card" radius={R} style={styles.ring} />

      {/* aligned gold ring overlay (a sibling View — never animate glass opacity) */}
      {isAligned ? <View pointerEvents="none" style={styles.ringAligned} /> : null}

      {/* rotating dial: ticks + cardinals + Kaaba marker */}
      <ReAnimated.View style={[styles.dialLayer, dialStyle]} pointerEvents="none">
        <Svg width={SIZE} height={SIZE}>
          <G>
            {ticks.map((t, i) => (
              <Line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.major ? withOpacity(colors.accent, 0.85) : withOpacity(colors.white, 0.4)}
                strokeWidth={t.major ? 2 : 1}
              />
            ))}
            {cardinals.map((c) => {
              const p = pointOnCircle(c.angle, R - 38);
              return (
                <SvgText
                  key={c.label}
                  x={p.x}
                  y={p.y + 5}
                  fontSize={15}
                  fontWeight="600"
                  textAnchor="middle"
                  fill={c.label === "N" ? colors.accent : withOpacity(colors.white, 0.45)}
                >
                  {c.label}
                </SvgText>
              );
            })}
          </G>
        </Svg>

        {/* Kaaba marker, placed at qiblaAngle within the (already -heading-rotated) layer */}
        <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${qiblaAngle}deg` }] }]}>
          <RNText style={styles.kaaba}>🕋</RNText>
        </View>
      </ReAnimated.View>

      {/* fixed top pointer (the direction you're facing) */}
      <View pointerEvents="none" style={styles.pointer} />

      {/* fixed core readout */}
      <View pointerEvents="none" style={styles.core}>
        {isAligned ? (
          <Title3>Facing Makkah</Title3>
        ) : (
          <>
            <Title1>{`${Math.round(qiblaAngle)}°`}</Title1>
            <Caption color={withOpacity(colors.white, 0.55)} style={styles.coreLabel}>
              to Makkah
            </Caption>
          </>
        )}
        {distanceKm != null ? (
          <Footnote color={colors.accent} style={styles.coreKm}>
            {`${formatKm(distanceKm)} km`}
          </Footnote>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors } = theme;
  return StyleSheet.create({
    root: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
    ring: {
      position: "absolute",
      width: SIZE,
      height: SIZE,
      borderRadius: R,
    },
    ringAligned: {
      position: "absolute",
      width: SIZE,
      height: SIZE,
      borderRadius: R,
      borderWidth: 1.5,
      borderColor: colors.accent,
      shadowColor: colors.accent,
      shadowOpacity: 0.55,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 0 },
    },
    dialLayer: { position: "absolute", width: SIZE, height: SIZE },
    ripple: {
      position: "absolute",
      width: SIZE,
      height: SIZE,
      borderRadius: R,
      borderWidth: 1.5,
      borderColor: withOpacity(colors.accent, 0.6),
    },
    kaaba: {
      position: "absolute",
      top: -2,
      left: R - 14,
      width: 28,
      fontSize: 26,
      textAlign: "center",
    },
    pointer: {
      position: "absolute",
      top: -14,
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 13,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: colors.accent,
    },
    core: { position: "absolute", alignItems: "center", justifyContent: "center", maxWidth: SIZE - 96 },
    coreLabel: { marginTop: 6, textTransform: "uppercase", letterSpacing: 1.2 },
    coreKm: { marginTop: 7 },
  });
};
