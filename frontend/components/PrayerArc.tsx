import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import PrayerStatusDot from "@/components/tracking/PrayerStatusDot";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { BREATH_HALF_CYCLE } from "@/constants/motion";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";
import type { PrayerTime } from "@/services/prayerTimes";
import {
  ARC_VIEWBOX,
  arcLength,
  arcPoint,
  isMarkerAbsorbed,
  prayerStates,
  sunMarker,
  type PrayerState,
} from "@/utils/prayerArc";
import { prayerNameForArcLabel } from "@/utils/prayerLabel";

const ARC_PATH = `M${arcPoint(0).x},${arcPoint(0).y} Q150,2 ${arcPoint(1).x},${arcPoint(1).y}`;
const TOTAL_LEN = arcLength(1);
// The progress thumb is the terminus of the gold stroke. The grey "remaining"
// arc restarts this many viewBox units past it so no line runs through it.
const THUMB_SIZE = 10;
const THUMB_KNOCKOUT = 4;
// Six columns share the card width, so their captions scale less than body text.
const COLUMN_FONT_SCALE = 1.2;

const STATUS_VALUE: Record<PrayerStatus, string> = {
  prayed: "Marked prayed",
  late: "Marked late",
  missed: "Marked missed",
};

type PrayerArcProps = {
  loading: boolean;
  prayerTimes: PrayerTime[];
  nextPrayer: { label: string; time: string } | null;
  now?: Date;
  live?: boolean;
  logging?: boolean;
  statuses?: Partial<Record<PrayerName, PrayerStatus>>;
  onPressPrayer?: (name: PrayerName, label: string) => void;
};

export default function PrayerArc({
  loading,
  prayerTimes,
  nextPrayer,
  now,
  live = true,
  logging = false,
  statuses,
  onPressPrayer,
}: PrayerArcProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();

  const prayers = useMemo(
    () => prayerStates(prayerTimes, live ? (nextPrayer?.label ?? null) : null),
    [prayerTimes, nextPrayer, live],
  );
  const progress = useMemo(
    () => (loading || !live ? null : sunMarker(prayerTimes, now ?? new Date())),
    [loading, live, prayerTimes, now],
  );
  const progressT = progress?.t ?? null;
  const thumbPoint = progressT != null ? arcPoint(progressT) : null;
  const progressLen = progressT != null ? arcLength(progressT) : 0;

  // Scale the dome uniformly from the measured width instead of stretching the
  // SVG, so strokes stay round while the slots still line up with the columns.
  const [wrapWidth, setWrapWidth] = useState(0);
  const scale = wrapWidth > 0 ? wrapWidth / ARC_VIEWBOX.width : 1;
  const arcHeight = ARC_VIEWBOX.height * scale;
  const onArcLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - wrapWidth) > 0.5) setWrapWidth(w);
  };
  const place = (p: { x: number; y: number }) => ({ left: p.x * scale, top: p.y * scale });

  // Gentle breathing shared by the thumb and the "next" ring (scale only; never
  // animate glass opacity). Skipped under Reduce Motion.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live || reduceMotion) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_HALF_CYCLE,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH_HALF_CYCLE,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, live, reduceMotion]);
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <GlassSurface tier="card" radius={theme.radii.cardLg} style={styles.card}>
      <Caption color={colors.textTertiary} style={styles.label}>
        {live ? "TODAY'S PRAYERS" : "PRAYER TIMES"}
      </Caption>

      <View style={[styles.arcWrap, { height: arcHeight }]} onLayout={onArcLayout}>
        <Svg
          width="100%"
          height={arcHeight}
          viewBox={`0 0 ${ARC_VIEWBOX.width} ${ARC_VIEWBOX.height}`}
        >
          <Line
            x1={arcPoint(0).x}
            y1={arcPoint(0).y}
            x2={arcPoint(1).x}
            y2={arcPoint(1).y}
            stroke={withOpacity(colors.white, 0.12)}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          <Path
            d={ARC_PATH}
            fill="none"
            stroke={withOpacity(colors.white, 0.22)}
            strokeWidth={2}
            strokeDasharray={
              progressT != null ? `0 ${progressLen + THUMB_KNOCKOUT} ${TOTAL_LEN}` : undefined
            }
          />
          {progressT != null ? (
            <Path
              d={ARC_PATH}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={`${progressLen} ${TOTAL_LEN}`}
            />
          ) : null}
        </Svg>

        {prayers.map((p) => {
          const state: PrayerState = live ? p.state : "upcoming";
          if (state === "passed" && isMarkerAbsorbed(p.t, progressT)) return null;
          return (
            <Marker
              key={p.label}
              state={state}
              position={place(p.point)}
              colors={colors}
              slot={styles.markerSlot}
              breathScale={breathScale}
              dim={loading}
            />
          );
        })}

        {thumbPoint ? (
          <Animated.View
            testID="arc-thumb"
            style={[styles.markerSlot, place(thumbPoint), { transform: [{ scale: breathScale }] }]}
            pointerEvents="none"
          >
            <View style={styles.thumb} />
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.row}>
        {prayers.map((p) => {
          const state: PrayerState = live ? p.state : "upcoming";
          const nameColor =
            state === "next"
              ? colors.accent
              : state === "passed"
                ? colors.textTertiary
                : colors.textSecondary;
          const timeColor =
            state === "next" ? colors.accent : state === "passed" ? colors.textTertiary : colors.white;

          const name = logging ? prayerNameForArcLabel(p.label) : null;
          const loggable = logging && name != null && (!live || state === "passed" || state === "next");
          const status = name ? statuses?.[name] : undefined;

          const column = (
            <View style={styles.col}>
              <Caption
                color={nameColor}
                numberOfLines={1}
                maxFontSizeMultiplier={COLUMN_FONT_SCALE}
                style={styles.name}
              >
                {p.label}
              </Caption>
              <Caption
                color={timeColor}
                numberOfLines={1}
                maxFontSizeMultiplier={COLUMN_FONT_SCALE}
                style={styles.time}
              >
                {p.time ? shortTime(p.time) : "—"}
              </Caption>
              {name ? <PrayerStatusDot status={status} loggable={loggable} /> : null}
            </View>
          );

          if (!logging) {
            return (
              <View key={p.label} style={styles.colWrap}>
                {column}
              </View>
            );
          }

          return loggable && onPressPrayer ? (
            <Pressable
              key={p.label}
              onPress={() => onPressPrayer(name!, p.label)}
              accessibilityRole="button"
              accessibilityLabel={`Log ${p.label}`}
              accessibilityValue={{ text: status ? STATUS_VALUE[status] : "Not logged" }}
              accessibilityHint="Opens the prayer log"
              style={styles.colWrap}
            >
              {column}
            </Pressable>
          ) : (
            <View key={p.label} style={styles.colWrap}>
              {column}
            </View>
          );
        })}
      </View>
    </GlassSurface>
  );
}

function Marker({
  state,
  position,
  colors,
  slot,
  breathScale,
  dim,
}: {
  state: PrayerState;
  position: { left: number; top: number };
  colors: AppTheme["colors"];
  slot: object;
  breathScale: Animated.AnimatedInterpolation<number>;
  dim: boolean;
}) {
  if (state === "next" && !dim) {
    return (
      <Animated.View
        style={[slot, position, { transform: [{ scale: breathScale }] }]}
        pointerEvents="none"
      >
        <View
          style={{
            width: 16,
            height: 16,
            marginLeft: -8,
            marginTop: -8,
            borderRadius: 999,
            borderWidth: 2.5,
            borderColor: colors.accent,
          }}
        />
      </Animated.View>
    );
  }

  if (state === "upcoming") {
    return (
      <View style={[slot, position]} pointerEvents="none">
        <View
          style={{
            width: 9,
            height: 9,
            marginLeft: -4.5,
            marginTop: -4.5,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: withOpacity(colors.white, dim ? 0.18 : 0.4),
          }}
        />
      </View>
    );
  }

  return (
    <View style={[slot, position]} pointerEvents="none">
      <View
        style={{
          width: 7,
          height: 7,
          marginLeft: -3.5,
          marginTop: -3.5,
          borderRadius: 999,
          backgroundColor: withOpacity(colors.accent, dim ? 0.2 : 0.5),
        }}
      />
    </View>
  );
}

// "5:42 PM" → "5:42" — the AM/PM is implied by position on the arc, and dropping
// it keeps six columns readable on narrow screens.
function shortTime(time: string): string {
  return time.split(" ")[0] ?? time;
}

const createStyles = (theme: AppTheme) => {
  const { spacing, colors } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, paddingBottom: spacing.md },
    label: { letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm },
    arcWrap: { position: "relative", marginHorizontal: spacing.xs },
    markerSlot: { position: "absolute" },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      marginLeft: -THUMB_SIZE / 2,
      marginTop: -THUMB_SIZE / 2,
      borderRadius: 999,
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOpacity: 0.85,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    row: { flexDirection: "row", marginTop: spacing.xs },
    colWrap: { flex: 1, minHeight: 44, justifyContent: "center" },
    col: { alignItems: "center", gap: 2 },
    name: { fontSize: 13 },
    time: { fontWeight: "700", fontSize: 14 },
  });
};
