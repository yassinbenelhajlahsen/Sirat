import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import PrayerStatusDot from "@/components/tracking/PrayerStatusDot";
import { Subhead } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { formatClock, type PrayerDay, type PrayerSlot } from "@/services/prayerDay";
import { isPrayerName, type PrayerName, type PrayerStatus } from "@/services/prayerTracker";

type PrayerTimesListProps = {
  prayerDay: PrayerDay;
  statuses: Partial<Record<PrayerName, PrayerStatus>>;
  /** Only today highlights the next prayer and holds back prayers still ahead. */
  isToday: boolean;
  nextPrayer: PrayerSlot | null;
  /** Past days and today can be logged; future days only list the times. */
  canLog: boolean;
  onPressPrayer: (name: PrayerName, label: string) => void;
  /** Ramadan fasting day: Fajr and Maghrib read as suhoor and iftar, in gold. */
  ramadan?: boolean;
};

const RAMADAN_LABELS: Record<string, string> = { Fajr: "Fajr/Suhoor", Maghrib: "Maghrib/Iftar" };

const STATUS_VALUE: Record<PrayerStatus, string> = {
  prayed: "Marked prayed",
  late: "Marked late",
  missed: "Marked missed",
};

export default function PrayerTimesList({
  prayerDay,
  statuses,
  isToday,
  nextPrayer,
  canLog,
  onPressPrayer,
  ramadan = false,
}: PrayerTimesListProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Today logs up to and including the next prayer; once all are done, every one.
  const nextIdx = isToday && nextPrayer ? prayerDay.slots.findIndex((p) => p.name === nextPrayer.name) : -1;

  return (
    <View style={styles.list}>
      {prayerDay.slots.map((p, fi) => {
        const name = isPrayerName(p.name) ? p.name : null;
        const status = name ? statuses[name] : undefined;
        const isNext = fi === nextIdx;
        const passed = isToday && nextIdx !== -1 && fi < nextIdx;
        const loggable = canLog && name != null && (!isToday || nextIdx === -1 || fi <= nextIdx);
        const ramadanLabel = ramadan ? RAMADAN_LABELS[p.name] : undefined;
        const nameColor = isNext || ramadanLabel ? colors.accent : passed ? colors.textTertiary : colors.textSecondary;
        const timeColor = isNext || ramadanLabel ? colors.accent : passed ? colors.textTertiary : colors.white;
        const row = (
          <View style={[styles.row, fi > 0 && styles.separator]}>
            <Subhead color={nameColor} style={styles.name}>
              {ramadanLabel ?? p.name}
            </Subhead>
            <Subhead color={timeColor} style={styles.time}>
              {formatClock(p.at)}
            </Subhead>
            {canLog ? (
              <View style={styles.dot}>
                {name ? <PrayerStatusDot status={status} loggable={loggable} /> : null}
              </View>
            ) : null}
          </View>
        );
        return loggable ? (
          <Pressable
            key={p.name}
            onPress={() => onPressPrayer(name, p.name)}
            accessibilityRole="button"
            accessibilityLabel={`Log ${p.name}`}
            accessibilityValue={{ text: status ? STATUS_VALUE[status] : "Not logged" }}
            accessibilityHint="Opens the prayer log"
            style={styles.item}
          >
            {row}
          </Pressable>
        ) : (
          <View key={p.name} style={styles.item}>
            {row}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    // Items share whatever height the panel has, so the list fills the screen
    // instead of leaving a gap under it.
    list: { flexGrow: 1 },
    item: { flexGrow: 1, minHeight: 44 },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    separator: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(colors.white, 0.1),
    },
    name: { flex: 1 },
    time: { fontWeight: "700" },
    dot: { width: 14, marginLeft: spacing.md, alignItems: "center" },
  });
};
