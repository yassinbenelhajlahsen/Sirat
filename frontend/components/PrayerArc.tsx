import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  DimensionValue,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import PrayerStatusDot from "@/components/tracking/PrayerStatusDot";
import { BREATH_HALF_CYCLE } from "@/constants/motion";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";
import type { PrayerTime } from "@/services/prayerTimes";
import {
  ARC_VIEWBOX,
  arcLength,
  arcPoint,
  prayerStates,
  sunMarker,
  type ArcPrayer,
} from "@/utils/prayerArc";
import { prayerNameForArcLabel } from "@/utils/prayerLabel";

const ARC_H = ARC_VIEWBOX.height;
const ARC_PATH = `M${arcPoint(0).x},${arcPoint(0).y} Q150,2 ${arcPoint(1).x},${arcPoint(1).y}`;
const TOTAL_LEN = arcLength(1);

const leftPct = (x: number): DimensionValue =>
  `${(x / ARC_VIEWBOX.width) * 100}%` as DimensionValue;

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

  const prayers = useMemo(
    () => prayerStates(prayerTimes, live ? (nextPrayer?.label ?? null) : null),
    [prayerTimes, nextPrayer, live],
  );
  const sun = useMemo(
    () => (loading || !live ? null : sunMarker(prayerTimes, now ?? new Date())),
    [loading, live, prayerTimes, now],
  );
  const sunPoint = sun ? arcPoint(sun.t) : null;
  const progressLen = sun ? arcLength(sun.t) : 0;

  // Gentle breathing of the sun/moon and the "next" ring (scale only — matches
  // the hero badge; never animate opacity of glass).
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live) return;
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
  }, [breath, live]);
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <GlassSurface tier="card" radius={theme.radii.cardLg} style={styles.card}>
      <Caption color={withOpacity(colors.white, 0.5)} style={styles.label}>
        {live ? "TODAY'S PRAYERS" : "PRAYER TIMES"}
      </Caption>

      <View style={styles.arcWrap}>
        <Svg
          width="100%"
          height={ARC_H}
          viewBox={`0 0 ${ARC_VIEWBOX.width} ${ARC_H}`}
          preserveAspectRatio="none"
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
          />
          {sun ? (
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

        {prayers.map((p) => (
          <Marker
            key={p.label}
            prayer={live ? p : { ...p, state: "upcoming" }}
            colors={colors}
            slot={styles.markerSlot}
            breathScale={breathScale}
            dim={loading}
          />
        ))}

        {sunPoint ? (
          <Animated.View
            style={[
              styles.markerSlot,
              { left: leftPct(sunPoint.x), top: sunPoint.y, transform: [{ scale: breathScale }] },
            ]}
            pointerEvents="none"
          >
            <Ionicons
              name={sun?.isNight ? "moon" : "sunny"}
              size={22}
              color={colors.accent}
              style={styles.sunGlyph}
            />
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.row}>
        {prayers.map((p) => {
          const state = live ? p.state : "upcoming";
          const nameColor =
            state === "next"
              ? colors.accent
              : withOpacity(colors.white, state === "passed" ? 0.4 : 0.75);
          const timeColor =
            state === "next"
              ? colors.accent
              : withOpacity(colors.white, state === "passed" ? 0.4 : 1);

          if (!logging) {
            return (
              <View key={p.label} style={styles.col}>
                <Caption color={nameColor} numberOfLines={1} style={styles.name}>
                  {p.label}
                </Caption>
                <Caption color={timeColor} numberOfLines={1} style={styles.time}>
                  {p.time ? shortTime(p.time) : "—"}
                </Caption>
              </View>
            );
          }

          const name = prayerNameForArcLabel(p.label);
          const loggable = logging && name != null && (!live || state === "passed" || state === "next");
          const status = name ? statuses?.[name] : undefined;

          const column = (
            <View style={styles.col}>
              <Caption color={nameColor} numberOfLines={1} style={styles.name}>
                {p.label}
              </Caption>
              <Caption color={timeColor} numberOfLines={1} style={styles.time}>
                {p.time ? shortTime(p.time) : "—"}
              </Caption>
              {name ? <PrayerStatusDot status={status} loggable={loggable} /> : null}
            </View>
          );

          return loggable && onPressPrayer ? (
            <Pressable
              key={p.label}
              onPress={() => onPressPrayer(name!, p.label)}
              accessibilityRole="button"
              accessibilityLabel={`Log ${p.label}`}
              style={{ flex: 1 }}
            >
              {column}
            </Pressable>
          ) : (
            <View key={p.label} style={{ flex: 1 }}>{column}</View>
          );
        })}
      </View>
    </GlassSurface>
  );
}

function Marker({
  prayer,
  colors,
  slot,
  breathScale,
  dim,
}: {
  prayer: ArcPrayer;
  colors: AppTheme["colors"];
  slot: object;
  breathScale: Animated.AnimatedInterpolation<number>;
  dim: boolean;
}) {
  const { point, state } = prayer;
  const pos = { left: leftPct(point.x), top: point.y };

  if (state === "next" && !dim) {
    return (
      <Animated.View
        style={[slot, pos, { transform: [{ scale: breathScale }] }]}
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
      <View style={[slot, pos]} pointerEvents="none">
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
    <View style={[slot, pos]} pointerEvents="none">
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
  const { spacing } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, paddingBottom: spacing.md },
    label: { letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm },
    arcWrap: { position: "relative", height: ARC_H, marginHorizontal: spacing.xs },
    markerSlot: { position: "absolute" },
    sunGlyph: {
      marginLeft: -11,
      marginTop: -11,
      textShadowColor: withOpacity(theme.colors.accent, 0.8),
      textShadowRadius: 8,
    },
    row: { flexDirection: "row", marginTop: spacing.xs },
    col: { flex: 1, alignItems: "center", gap: 2 },
    name: { fontSize: 11 },
    time: { fontWeight: "700", fontSize: 12 },
  });
};
