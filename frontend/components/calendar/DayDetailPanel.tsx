import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import PrayerArc from "@/components/PrayerArc";
import GlassSurface from "@/components/ui/GlassSurface";
import { Body, Caption, Headline, Title2 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerTimesError } from "@/hooks/usePrayerTimes";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";
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
  statuses: Partial<Record<PrayerName, PrayerStatus>>;
  onPressPrayer: (name: PrayerName, label: string) => void;
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
  statuses,
  onPressPrayer,
}: DayDetailPanelProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      </View>

      {holiday ? (
        <GlassSurface tier="row" radius={theme.radii.row} style={styles.holidayRow}>
          <Caption color={withOpacity(colors.white, 0.5)} style={styles.holidayLabel}>
            Holiday
          </Caption>
          <Body color={colors.accent}>{holiday}</Body>
        </GlassSurface>
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
              <Headline color={colors.onAccent}>Try again</Headline>
            </TouchableOpacity>
            {error.code === "PERMISSION" ? (
              <TouchableOpacity
                onPress={onOpenSettings}
                accessibilityRole="button"
                accessibilityLabel="Open app settings"
                style={styles.secondaryBtn}
              >
                <Headline color={colors.accent}>Open Settings</Headline>
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
            <Headline color={colors.onAccent}>Try again</Headline>
          </TouchableOpacity>
        </GlassSurface>
      ) : (
        <PrayerArc
          loading={loading}
          prayerTimes={prayerTimes}
          nextPrayer={isToday ? nextPrayer : null}
          live={isToday}
          logging
          statuses={statuses}
          onPressPrayer={onPressPrayer}
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
    // Mirrors the PrayerArc card's horizontal padding and eyebrow label so the
    // holiday text lines up with the arc content below it.
    holidayRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
      gap: 2,
    },
    holidayLabel: { letterSpacing: 1.2, textTransform: "uppercase" },
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
    emptyText: { textAlign: "center" },
    emptyBtn: { alignSelf: "center", marginTop: spacing.sm + 2 },
  });
};
