import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { withOpacity, type AppTheme } from "@/constants/theme";

type Star = { x: number; y: number; size: number };
type StarLayer = { stars: Star[]; twinkleMs: number; delayMs: number };

// Seeded so the field is the same on every launch and in tests.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Twinkle is one looping opacity per layer, not one value per star.
const LAYER_DEFS = [
  { count: 18, minSize: 1, maxSize: 1.5, twinkleMs: 2200, delayMs: 0 },
  { count: 16, minSize: 1, maxSize: 2, twinkleMs: 3000, delayMs: 700 },
  { count: 14, minSize: 1.5, maxSize: 2, twinkleMs: 4000, delayMs: 1500 },
];

export const STAR_LAYERS: StarLayer[] = (() => {
  const rand = mulberry32(1448);
  return LAYER_DEFS.map(({ count, minSize, maxSize, twinkleMs, delayMs }) => ({
    twinkleMs,
    delayMs,
    stars: Array.from({ length: count }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      size: minSize + rand() * (maxSize - minSize),
    })),
  }));
})();

const DRIFT_PX = -24;
const DRIFT_MS = 40000;
const HORIZON_RISE_PX = -28;
const HORIZON_BREATH_MS = 7000;

export type GlowVariant = "focused" | "soft";

export const GLOW_OPACITY: Record<GlowVariant, number> = { focused: 0.3, soft: 0.16 };

// Radial falloff as [offset, share of the glow's opacity]. Focused is a tight
// pool that suits a block of text above it; soft spreads across the whole
// width and fades evenly, for a screen with nothing above it.
const GLOW_STOPS: Record<GlowVariant, [number, number][]> = {
  focused: [[0, 1], [0.7, 0]],
  soft: [[0, 1], [0.5, 0.4], [1, 0]],
};
const STAR_FLOOR = 0.12;
const STAR_STILL = 0.5;

function StarLayerView({
  layer,
  color,
  peak,
  reduceMotion,
}: {
  layer: StarLayer;
  color: string;
  peak: number;
  reduceMotion: boolean;
}) {
  const opacity = useSharedValue(STAR_STILL * peak);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = STAR_STILL * peak;
      drift.value = 0;
      return;
    }
    opacity.value = STAR_FLOOR * peak;
    opacity.value = withDelay(
      layer.delayMs,
      withRepeat(
        withTiming(peak, { duration: layer.twinkleMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    drift.value = withTiming(DRIFT_PX, { duration: DRIFT_MS, easing: Easing.linear });
  }, [reduceMotion, peak, layer, opacity, drift]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: drift.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {layer.stars.map((s, i) => (
        <View
          key={i}
          testID="splash-star"
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </Animated.View>
  );
}

/**
 * Night sky for the splash: a vertical gradient, a horizon glow that breathes,
 * (only when given a glow to follow), and three layers of twinkling stars. On the Light theme it is a dawn: cream
 * sky with faint gold dust. Absolute-fill and non-interactive.
 */
export default function SplashSky({
  theme,
  reduceMotion,
  glow,
}: {
  theme: AppTheme;
  reduceMotion: boolean;
  /** The horizon glow and the 0..1 value its opacity follows. Omit for none. */
  glow?: { progress: SharedValue<number>; variant: GlowVariant };
}) {
  const { colors, aurora } = theme;
  const isLight = theme.name === "light";
  const glowId = `splashGlow${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withTiming(HORIZON_RISE_PX, {
        duration: HORIZON_BREATH_MS,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [reduceMotion, breath]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow ? glow.progress.value : 1,
    transform: [{ translateY: breath.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={
          isLight
            ? [colors.primaryLift, colors.primary, colors.primaryDeep]
            : [colors.primaryDark, colors.primaryDeep, colors.primaryLift]
        }
        locations={isLight ? [0, 0.5, 1] : [0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      {isLight ? null : (
        <LinearGradient
          colors={[withOpacity(colors.black, 0.5), "transparent"]}
          style={styles.vignette}
        />
      )}
      {glow ? (
        <Animated.View
          testID={`splash-glow-${glow.variant}`}
          style={[styles.horizon, glow.variant === "soft" && styles.horizonSoft, glowStyle]}
        >
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
                {GLOW_STOPS[glow.variant].map(([offset, share]) => (
                  <Stop
                    key={offset}
                    offset={offset}
                    stopColor={aurora.accent}
                    stopOpacity={GLOW_OPACITY[glow.variant] * share}
                  />
                ))}
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glowId})`} />
          </Svg>
        </Animated.View>
      ) : null}
      {STAR_LAYERS.map((layer, i) => (
        <StarLayerView
          key={i}
          layer={layer}
          color={isLight ? colors.accent : colors.textPrimary}
          peak={isLight ? 0.45 : 0.9}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vignette: { position: "absolute", left: 0, right: 0, top: 0, height: "40%" },
  horizon: {
    position: "absolute",
    left: "-25%",
    right: "-25%",
    bottom: -200,
    height: "55%",
  },
  // Wider and shorter than the focused pool, so no centre shows.
  horizonSoft: { left: "-60%", right: "-60%", bottom: -120, height: "34%" },
});
