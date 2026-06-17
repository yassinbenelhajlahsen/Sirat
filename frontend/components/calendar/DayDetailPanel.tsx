import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import PrayerArc from "@/components/PrayerArc";
import GlassSurface from "@/components/ui/GlassSurface";
import { Body, Caption, Headline, Title2 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import type { PrayerTimesError } from "@/hooks/usePrayerTimes";
import type { PrayerTime } from "@/services/prayerTimes";

type DayDetailPanelProps = {
  date: Date;
  isToday: boolean;
  holiday: string | null;
  loading: boolean;
  prayerTimes: PrayerTime[];
  error: PrayerTimesError | null;
  onRetry: () => void;
  onOpenSettings: () => void;
  nextPrayer: { label: string; time: string } | null;
  timeLeft: string;
  isRamadan: boolean;
  isFastMissed: boolean;
  onToggleMissedFast: () => void;
};

export default function DayDetailPanel({
  date,
  isToday,
  holiday,
  loading,
  prayerTimes,
  error,
  onRetry,
  onOpenSettings,
  nextPrayer,
  timeLeft,
  isRamadan,
  isFastMissed,
  onToggleMissedFast,
}: DayDetailPanelProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const haptics = useHaptics();

  const dateLine = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const hijri = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Title2 numberOfLines={1}>{isToday ? `Today · ${dateLine}` : dateLine}</Title2>
          <Caption color={withOpacity(colors.accent, 0.95)} style={styles.hijri}>
            {hijri}
          </Caption>
        </View>
        {holiday ? (
          <GlassSurface tier="row" radius={theme.radii.pill} style={styles.chip}>
            <Ionicons name="sparkles-outline" size={13} color={colors.accent} />
            <Caption color={colors.accent} numberOfLines={1} style={styles.chipText}>
              {holiday}
            </Caption>
          </GlassSurface>
        ) : null}
      </View>

      {isRamadan ? (
        <TouchableOpacity
          onPress={() => {
            haptics("light");
            onToggleMissedFast();
          }}
          accessibilityRole="button"
          accessibilityLabel={isFastMissed ? "Clear missed fast" : "Mark fast as missed"}
          style={[styles.toggle, isFastMissed ? styles.toggleOn : null]}
        >
          <Ionicons
            name={isFastMissed ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={isFastMissed ? colors.onAccent : colors.accent}
          />
          <Headline color={isFastMissed ? colors.onAccent : colors.accent} style={styles.toggleText}>
            {isFastMissed ? "Marked as missed fast" : "Mark fast as missed"}
          </Headline>
        </TouchableOpacity>
      ) : null}

      {isToday && nextPrayer ? (
        <Caption color={withOpacity(colors.white, 0.7)} style={styles.nextLine}>
          Next {nextPrayer.label}
          {timeLeft ? ` · in ${timeLeft}` : ""}
        </Caption>
      ) : null}

      {error ? (
        <GlassSurface tier="card" radius={theme.radii.card} style={styles.stateCard}>
          <View style={styles.stateHeader}>
            <Ionicons name="alert-circle" size={18} color={colors.accent} />
            <Headline color={colors.accent} style={styles.stateTitle}>
              Problem loading prayer times
            </Headline>
          </View>
          <Body color={withOpacity(colors.white, 0.9)} style={styles.stateMsg}>
            {error.message}
          </Body>
          <View style={styles.stateActions}>
            <TouchableOpacity
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry loading prayer times"
              style={styles.primaryBtn}
            >
              <Body color={colors.onAccent} style={styles.primaryBtnText}>Try again</Body>
            </TouchableOpacity>
            {error.code === "PERMISSION" ? (
              <TouchableOpacity
                onPress={onOpenSettings}
                accessibilityRole="button"
                accessibilityLabel="Open app settings"
                style={styles.secondaryBtn}
              >
                <Body color={colors.accent} style={styles.primaryBtnText}>Open Settings</Body>
              </TouchableOpacity>
            ) : null}
          </View>
        </GlassSurface>
      ) : !loading && prayerTimes.length === 0 ? (
        <GlassSurface tier="card" radius={theme.radii.card} style={styles.stateCard}>
          <Body color={withOpacity(colors.white, 0.9)} style={styles.emptyText}>
            No prayer times available for this date.
          </Body>
          <TouchableOpacity
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading prayer times"
            style={[styles.primaryBtn, styles.emptyBtn]}
          >
            <Body color={colors.onAccent} style={styles.primaryBtnText}>Try again</Body>
          </TouchableOpacity>
        </GlassSurface>
      ) : (
        <PrayerArc
          loading={loading}
          prayerTimes={prayerTimes}
          nextPrayer={isToday ? nextPrayer : null}
          live={isToday}
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    headerText: { flexShrink: 1 },
    hijri: { marginTop: 2 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 1,
      maxWidth: "52%",
    },
    chipText: { flexShrink: 1 },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.4),
      marginBottom: spacing.md,
    },
    toggleOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    toggleText: {},
    nextLine: { marginBottom: spacing.sm },
    stateCard: { padding: spacing.lg },
    stateHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stateTitle: { flexShrink: 1 },
    stateMsg: { marginTop: spacing.sm },
    stateActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginTop: spacing.md },
    primaryBtn: {
      backgroundColor: colors.accent,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg - 2,
      borderRadius: theme.radii.chip,
    },
    secondaryBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg - 2,
      borderRadius: theme.radii.chip,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    primaryBtnText: { fontFamily: "SFProDisplay-Semibold" },
    emptyText: { textAlign: "center" },
    emptyBtn: { alignSelf: "center", marginTop: spacing.sm + 2 },
  });
};
