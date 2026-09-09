import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerStatus } from "@/services/prayerTracker";

type Props = { status?: PrayerStatus; loggable: boolean };

const SIZE = 14;

/**
 * Prayer log state under an arc column. Each status has its own glyph as well
 * as its own colour so Prayed/Late/Missed stay distinguishable without colour.
 */
export default function PrayerStatusDot({ status, loggable }: Props) {
  const { colors } = useTheme().theme;

  if (status === "prayed") {
    return (
      <View testID="dot-prayed" style={styles.slot}>
        <Ionicons name="checkmark-circle" size={SIZE} color={colors.accentSecondary} />
      </View>
    );
  }
  if (status === "late") {
    return (
      <View testID="dot-late" style={styles.slot}>
        <Ionicons name="time" size={SIZE} color={colors.accent} />
      </View>
    );
  }
  if (status === "missed") {
    return (
      <View testID="dot-missed" style={styles.slot}>
        <Ionicons name="close-circle" size={SIZE} color={colors.danger} />
      </View>
    );
  }
  if (loggable) {
    return (
      <View testID="dot-loggable" style={styles.slot}>
        <Ionicons name="ellipse-outline" size={SIZE} color={colors.iconMuted} />
      </View>
    );
  }
  return (
    <View testID="dot-upcoming" style={styles.slot}>
      <View style={[styles.upcoming, { backgroundColor: withOpacity(colors.white, 0.25) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: SIZE, alignItems: "center", justifyContent: "center" },
  upcoming: { width: 6, height: 6, borderRadius: 999 },
});
