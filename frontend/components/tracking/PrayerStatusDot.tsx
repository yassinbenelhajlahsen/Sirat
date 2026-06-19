import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerStatus } from "@/services/prayerTracker";

type Props = { status?: PrayerStatus; loggable: boolean };

export default function PrayerStatusDot({ status, loggable }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (status === "prayed") return <View testID="dot-prayed" style={[styles.dot, styles.prayed]} />;
  if (status === "late") return <View testID="dot-late" style={[styles.dot, styles.late]} />;
  if (status === "missed") return <View testID="dot-missed" style={[styles.dot, styles.missed]} />;
  if (loggable) return <View testID="dot-loggable" style={styles.loggable} />;
  return <View testID="dot-upcoming" style={styles.upcoming} />;
}

const createStyles = (theme: AppTheme) => {
  const { colors } = theme;
  return StyleSheet.create({
    dot: { width: 7, height: 7, borderRadius: 999 },
    prayed: { backgroundColor: colors.accentSecondary },
    late: { backgroundColor: colors.accent },
    missed: { backgroundColor: colors.danger },
    loggable: {
      width: 9,
      height: 9,
      borderRadius: 999,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: withOpacity(colors.white, 0.5),
    },
    upcoming: {
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.white, 0.25),
    },
  });
};
