import { StyleSheet } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";

// Layout only — text sizes, weights and colours come from the shared AppText
// variants and semantic tokens at the call site.
export const getNotificationStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;

  return StyleSheet.create({
    section: { marginTop: theme.spacing.xl },
    sectionLabel: {
      letterSpacing: 1,
      marginLeft: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    card: { overflow: "hidden" },
    masterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    masterIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(themeColors.accent, 0.14),
    },
    masterText: { flex: 1, minWidth: 0 },
    masterSubtitle: { marginTop: 2 },
    masterControl: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 44,
      paddingLeft: 8,
    },
    masterStatus: { fontWeight: "600" },
    reveal: { paddingHorizontal: 14, overflow: "hidden" },
    revealDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: withOpacity(themeColors.white, 0.08),
      marginBottom: 14,
    },
    prayerSectionHeader: {
      marginBottom: 10,
    },
    prayerSectionTitle: { fontWeight: "600" },
    prayerSectionDescription: { marginTop: 3 },
    prayerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -5,
    },
    gridCell3: { width: "33.333%", padding: 5 },
    gridCell4: { width: "25%", padding: 5 },
    prayerCard: {
      borderRadius: 14,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      minHeight: 88,
      paddingVertical: 14,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      overflow: "hidden",
    },
    prayerCardPressed: {
      opacity: 0.85,
    },
    prayerCardLabel: { fontWeight: "600", letterSpacing: 0.2 },
    prayerCardStatus: { fontWeight: "600" },
    soundCard: {
      marginTop: 14,
      marginBottom: 14,
      borderRadius: 12,
      borderWidth: 2,
      paddingVertical: 16,
      paddingHorizontal: 14,
      backgroundColor: withOpacity(themeColors.primaryDeep, 0.4),
      borderColor: withOpacity(themeColors.white, 0.05),
      shadowColor: withOpacity(themeColors.black, 0.05),
      shadowOpacity: 0.25,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
    soundSectionSubtitle: { marginTop: 6 },
    soundSegmentRow: {
      flexDirection: "row",
      marginTop: 18,
      marginBottom: 10,
      position: "relative",
    },
    soundSegment: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(themeColors.white, 0.05),
      borderColor: withOpacity(themeColors.white, 0.08),
    },
    soundSegmentLabel: { fontWeight: "600" },
    soundSegmentHighlight: {
      position: "absolute",
      top: 0,
      bottom: 0,
      borderRadius: 12,
      borderWidth: 2,
      opacity: 0.95,
    },
    soundDescriptionBox: {
      marginTop: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      borderColor: withOpacity(themeColors.white, 0.12),
      backgroundColor: withOpacity(themeColors.white, 0.04),
    },
    soundDescriptionText: {},
    soundPreviewButton: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    soundPreviewText: { marginLeft: 8, fontWeight: "600" },
  });
};

export type NotificationStyles = ReturnType<typeof getNotificationStyles>;
