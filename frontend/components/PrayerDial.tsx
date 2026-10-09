import { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import PrayerStatusDot from "@/components/tracking/PrayerStatusDot";
import DisplayNumber from "@/components/ui/DisplayNumber";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";
import type { PrayerTime } from "@/services/prayerTimes";
import {
  DIAL,
  STARS,
  angleForMinutes,
  buildRing,
  daylightLabel,
  dialMarkers,
  discStops,
  minutesOfDay,
  pointOnRing,
  ringColor,
  starLevel,
  sunAltitude,
  type RingSegment,
} from "@/utils/prayerDial";
import { prayerNameForArcLabel } from "@/utils/prayerLabel";
import { sunDay } from "@/utils/sky";

/**
 * The sky moves slowly. Colour never shifts more than ~0.011 Oklab in a minute,
 * which is under the just-noticeable difference, so a minute tick looks smooth
 * without interpolation. Deliberately not the 1s tick that drives the countdown.
 */
const SKY_TICK_MS = 60_000;

const STATUS_VALUE: Record<PrayerStatus, string> = {
  prayed: "Marked prayed",
  late: "Marked late",
  missed: "Marked missed",
};

const COLUMN_FONT_SCALE = 1.2;

// Sits inside the 13-unit band and gives every marker the same dark ground to
// read against, whatever colour the day's light is at that hour.
const MARKER_KNOCKOUT = 5.6;
const MARKER_GROUND = "rgba(8,16,11,0.55)";

type Coords = { latitude: number; longitude: number };

type PrayerDialProps = {
  loading: boolean;
  prayerTimes: PrayerTime[];
  nextPrayer: { label: string; time: string } | null;
  /** Live countdown string, already formatted (e.g. "1h 24m 33s"). */
  timeLeft?: string;
  /** Tomorrow's Fajr, shown once today's prayers are done. */
  tomorrowFajr?: string | null;
  /** The day being shown. Defaults to today. */
  date?: Date;
  /** Override "now" for tests and stable snapshots. */
  now?: Date;
  live?: boolean;
  coords?: Coords | null;
  logging?: boolean;
  statuses?: Partial<Record<PrayerName, PrayerStatus>>;
  onPressPrayer?: (name: PrayerName, label: string) => void;
  /** Tapping the dial once the day is done. Routes to tomorrow on Home. */
  onPressCentre?: () => void;
};

export default function PrayerDial({
  loading,
  prayerTimes,
  nextPrayer,
  timeLeft,
  tomorrowFajr,
  date,
  now,
  live = true,
  coords,
  logging = false,
  statuses,
  onPressPrayer,
  onPressCentre,
}: PrayerDialProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // The sky advances on its own clock. `now` short-circuits it for tests.
  const [tick, setTick] = useState(() => now ?? new Date());
  useEffect(() => {
    if (now || !live) return;
    setTick(new Date());
    const id = setInterval(() => setTick(new Date()), SKY_TICK_MS);
    return () => clearInterval(id);
  }, [now, live]);
  const at = now ?? tick;

  const day = useMemo(() => date ?? new Date(), [date]);
  const markers = useMemo(() => dialMarkers(prayerTimes, day), [prayerTimes, day]);

  // Ring colours depend only on the date and the place, so they survive every
  // tick. Keyed on a coarse coordinate bucket for the same reason.
  const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  const coordKey = coords ? `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}` : "";
  const ring = useMemo<RingSegment[] | null>(
    () => (live && coords ? buildRing(day, coords.latitude, coords.longitude) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, coordKey, dayKey],
  );

  const solar = useMemo(
    () => (coords ? sunDay(day, coords.latitude, coords.longitude) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coordKey, dayKey],
  );

  const sunAlt = coords && live ? sunAltitude(at, coords.latitude, coords.longitude) : null;
  const stops = useMemo(() => (sunAlt == null ? null : discStops(sunAlt)), [sunAlt]);
  const stars = sunAlt == null ? 0 : starLevel(sunAlt);

  const nowMinutes = live ? minutesOfDay(at) : null;
  const sunPoint = nowMinutes == null ? null : pointOnRing(angleForMinutes(nowMinutes));

  const [wrapWidth, setWrapWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - wrapWidth) > 0.5) setWrapWidth(w);
  };

  const centre = centreContent({
    live,
    loading,
    nextPrayer,
    timeLeft,
    tomorrowFajr,
    day,
    statuses,
    daylight: daylightLabel(solar?.sunrise ?? null, solar?.sunset ?? null),
    colors,
  });

  const loggedCount = countLogged(statuses);

  const dial = (
    <View style={styles.dialWrap} onLayout={onLayout}>
      <Svg width="100%" height={wrapWidth || undefined} viewBox={`0 0 ${DIAL.size} ${DIAL.size}`}>
        <Defs>
          {stops ? (
            <LinearGradient
              id="dialSky"
              gradientUnits="userSpaceOnUse"
              x1={DIAL.cx}
              y1={DIAL.cy + DIAL.discRadius}
              x2={DIAL.cx}
              y2={DIAL.cy - DIAL.discRadius}
            >
              {stops.map((s) => (
                <Stop
                  key={s.offset}
                  offset={s.offset}
                  stopColor={s.color}
                  stopOpacity={s.opacity}
                />
              ))}
            </LinearGradient>
          ) : null}
          <RadialGradient id="dialVignette" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#060E0A" stopOpacity="0" />
            <Stop offset="0.62" stopColor="#060E0A" stopOpacity="0" />
            <Stop offset="1" stopColor="#060E0A" stopOpacity="0.34" />
          </RadialGradient>
          <RadialGradient id="dialCorona" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF6DE" stopOpacity="0.85" />
            <Stop offset="0.35" stopColor="#F5D98F" stopOpacity="0.45" />
            <Stop offset="0.7" stopColor={colors.accent} stopOpacity="0.16" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Sky disc: the whole disc is sky, horizon at the bottom, zenith at the top. */}
        {stops ? (
          <>
            <Circle cx={DIAL.cx} cy={DIAL.cy} r={DIAL.discRadius} fill="url(#dialSky)" />
            {stars > 0
              ? STARS.map((s, i) => (
                  <Circle
                    key={i}
                    cx={s.x}
                    cy={s.y}
                    r={s.r}
                    fill="#EAF0FF"
                    opacity={Math.min(0.95, s.o * stars)}
                  />
                ))
              : null}
            <Circle cx={DIAL.cx} cy={DIAL.cy} r={DIAL.discRadius} fill="url(#dialVignette)" />
          </>
        ) : null}

        {/* Base track, always present so the ring has a body when nothing else draws. */}
        <Circle
          cx={DIAL.cx}
          cy={DIAL.cy}
          r={DIAL.ringRadius}
          fill="none"
          stroke={withOpacity(colors.white, 0.05)}
          strokeWidth={DIAL.ringWidth}
        />

        {ring ? (
          // Every stroke is opaque and the elapsed/remaining difference is
          // carried in the colour, so overlapping segments cannot double their
          // alpha, and the day's two ends fade out instead of stepping.
          <G>
            {ring.map((s, i) => (
              <Path
                key={i}
                d={s.d}
                fill="none"
                stroke={ringColor(s, nowMinutes, colors.primaryDark)}
                strokeWidth={DIAL.ringWidth}
              />
            ))}
          </G>
        ) : (
          // A day that is not today gets one treatment, whether it is behind
          // or ahead. Neither has a "now", and a dashed ring only ever read as
          // stitching across the dial.
          <Circle
            cx={DIAL.cx}
            cy={DIAL.cy}
            r={DIAL.ringRadius}
            fill="none"
            stroke={
              loggedCount > 0
                ? withOpacity(colors.accentSecondary, 0.24)
                : withOpacity(colors.white, 0.17)
            }
            strokeWidth={DIAL.ringWidth}
          />
        )}

        {markers.map((m) => {
          if (m.notch) {
            // Sunrise is not a prayer, so it gets no column and no status. It
            // still ends the Fajr window, so its time is set beside the notch
            // rather than dropped altogether.
            const outward = pointOnRing(m.angle, DIAL.ringRadius + 13);
            const left = outward.x < DIAL.cx;
            return (
              <G key={m.label}>
                <Circle cx={m.point.x} cy={m.point.y} r={1.5} fill="rgba(10,21,14,0.45)" />
                {m.time ? (
                  <SvgText
                    x={outward.x + (left ? -2 : 2)}
                    y={outward.y + 3}
                    fontSize={9}
                    fill={colors.textTertiary}
                    textAnchor={left ? "end" : "start"}
                  >
                    {shortTime(m.time)}
                  </SvgText>
                ) : null}
              </G>
            );
          }
          const name = prayerNameForArcLabel(m.label);
          const status = name ? statuses?.[name] : undefined;
          return (
            <G key={m.label}>
              {/* The band runs from near-white at noon to deep indigo at night,
                  so a marker with one fixed colour disappears at one end of the
                  day. This knockout gives every marker the same dark ground. */}
              <Circle cx={m.point.x} cy={m.point.y} r={MARKER_KNOCKOUT} fill={MARKER_GROUND} />
              {status === "prayed" || status === "late" ? (
                <Circle
                  cx={m.point.x}
                  cy={m.point.y}
                  r={3.5}
                  fill={status === "prayed" ? colors.accentSecondary : colors.accent}
                />
              ) : status === "missed" ? (
                <Circle
                  cx={m.point.x}
                  cy={m.point.y}
                  r={3.6}
                  fill="none"
                  stroke={colors.danger}
                  strokeWidth={2}
                />
              ) : (
                <Circle
                  cx={m.point.x}
                  cy={m.point.y}
                  r={3.3}
                  fill="none"
                  stroke={withOpacity(colors.white, 0.72)}
                  strokeWidth={1.8}
                />
              )}
            </G>
          );
        })}

        {/* Sun while it is up, a soft pale dot once it is down. No moon. */}
        {sunPoint && sunAlt != null && !loading ? (
          sunAlt > -6 ? (
            <>
              <Circle cx={sunPoint.x} cy={sunPoint.y} r={23} fill="url(#dialCorona)" opacity={0.5} />
              <Circle cx={sunPoint.x} cy={sunPoint.y} r={12.5} fill="url(#dialCorona)" opacity={0.85} />
              <Circle
                cx={sunPoint.x}
                cy={sunPoint.y}
                r={6.4}
                fill="#FFFBF0"
                stroke="rgba(10,21,14,0.5)"
                strokeWidth={1.6}
              />
            </>
          ) : (
            <>
              <Circle cx={sunPoint.x} cy={sunPoint.y} r={9} fill="#CFE0FF" opacity={0.12} />
              <Circle cx={sunPoint.x} cy={sunPoint.y} r={3.4} fill="#E8EEFF" opacity={0.8} />
            </>
          )
        ) : null}
      </Svg>

      <View style={styles.centre} pointerEvents="none">
        <Caption
          testID="dial-label"
          color={colors.textSecondary}
          style={styles.centreLabel}
          numberOfLines={1}
        >
          {centre.label}
        </Caption>
        {centre.value ? (
          <DisplayNumber testID="dial-value" value={centre.value} size={centre.size} />
        ) : null}
        {centre.sub ? (
          <Caption
            testID="dial-sub"
            color={centre.subColor}
            style={styles.centreSub}
            numberOfLines={1}
          >
            {centre.sub}
          </Caption>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      {onPressCentre ? (
        <Pressable
          onPress={onPressCentre}
          accessibilityRole="button"
          accessibilityLabel={centre.pressLabel ?? "View tomorrow's prayer times"}
        >
          {dial}
        </Pressable>
      ) : (
        dial
      )}

      <View style={styles.row}>
        {markers
          .filter((m) => !m.notch)
          .map((m) => {
            const name = logging ? prayerNameForArcLabel(m.label) : null;
            const status = name ? statuses?.[name] : undefined;
            const isNext = live && nextPrayer?.label === m.label;
            const passed = live && nowMinutes != null && m.minutes != null && m.minutes <= nowMinutes;
            const loggable = logging && name != null && (!live || passed || isNext);

            const nameColor = isNext
              ? colors.accent
              : passed
                ? colors.textTertiary
                : colors.textSecondary;
            const timeColor = isNext
              ? colors.accent
              : passed
                ? colors.textTertiary
                : colors.white;

            const column = (
              <View style={styles.col}>
                <Caption
                  color={nameColor}
                  numberOfLines={1}
                  maxFontSizeMultiplier={COLUMN_FONT_SCALE}
                  style={styles.name}
                >
                  {m.label}
                </Caption>
                <Caption
                  color={timeColor}
                  numberOfLines={1}
                  maxFontSizeMultiplier={COLUMN_FONT_SCALE}
                  style={styles.time}
                >
                  {m.time ? shortTime(m.time) : "—"}
                </Caption>
                {name ? <PrayerStatusDot status={status} loggable={loggable} /> : null}
              </View>
            );

            return loggable && onPressPrayer ? (
              <Pressable
                key={m.label}
                onPress={() => onPressPrayer(name!, m.label)}
                accessibilityRole="button"
                accessibilityLabel={`Log ${m.label}`}
                accessibilityValue={{ text: status ? STATUS_VALUE[status] : "Not logged" }}
                accessibilityHint="Opens the prayer log"
                style={styles.colWrap}
              >
                {column}
              </Pressable>
            ) : (
              <View key={m.label} style={styles.colWrap}>
                {column}
              </View>
            );
          })}
      </View>
    </View>
  );
}

function countLogged(statuses?: Partial<Record<PrayerName, PrayerStatus>>): number {
  if (!statuses) return 0;
  return Object.values(statuses).filter((s) => s === "prayed" || s === "late").length;
}



const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Centre = {
  label: string;
  value: string | null;
  size: number;
  sub: string | null;
  subColor: string;
  pressLabel?: string;
};

// A clock time is the headline and gets the display size; a date is a caption
// for a day you are only browsing, so it sits a step down.
const TIME_SIZE = 54;
const DATE_SIZE = 44;

function centreContent({
  live,
  loading,
  nextPrayer,
  timeLeft,
  tomorrowFajr,
  day,
  statuses,
  daylight,
  colors,
}: {
  live: boolean;
  loading: boolean;
  nextPrayer: { label: string; time: string } | null;
  timeLeft?: string;
  tomorrowFajr?: string | null;
  day: Date;
  statuses?: Partial<Record<PrayerName, PrayerStatus>>;
  daylight: string | null;
  colors: AppTheme["colors"];
}): Centre {
  if (loading) {
    return { label: "", value: null, size: TIME_SIZE, sub: null, subColor: colors.textSecondary };
  }

  if (live && nextPrayer) {
    return {
      label: nextPrayer.label.toUpperCase(),
      value: shortTime(nextPrayer.time),
      size: TIME_SIZE,
      sub: timeLeft ? `in ${timeLeft}` : null,
      subColor: colors.accent,
    };
  }

  if (live) {
    // Everything is prayed for today, so the dial rolls over to tomorrow.
    return {
      label: "FAJR TOMORROW",
      value: tomorrowFajr ? shortTime(tomorrowFajr) : null,
      size: TIME_SIZE,
      sub: "Prayers done for today",
      subColor: colors.textSecondary,
      pressLabel: "View tomorrow's prayer times",
    };
  }

  const logged = countLogged(statuses);

  return {
    label: WEEKDAYS[day.getDay()],
    value: `${day.getDate()} ${MONTHS[day.getMonth()]}`,
    size: DATE_SIZE,
    // Tracking only ever adds a line. A day with nothing logged still says
    // something true, so the card is worth opening for someone who never logs
    // and reads the same whether the day is behind or ahead.
    sub: logged > 0 ? `${logged} of 5 prayed` : daylight,
    subColor: logged > 0 ? colors.accentSecondary : colors.textSecondary,
  };
}

// "5:42 PM" -> "5:42". The period is implied by where it sits on the dial.
function shortTime(time: string): string {
  return time.split(" ")[0] ?? time;
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { paddingHorizontal: spacing.xs },
    dialWrap: { position: "relative", aspectRatio: 1, justifyContent: "center" },
    centre: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    centreLabel: { fontSize: 11, letterSpacing: 3 },
    centreSub: { fontSize: 13 },
    row: { flexDirection: "row", marginTop: spacing.xs },
    colWrap: { flex: 1, minHeight: 44, justifyContent: "flex-start" },
    col: { alignItems: "center", gap: 2 },
    name: { fontSize: 13 },
    time: { fontWeight: "700", fontSize: 14 },
  });
};
