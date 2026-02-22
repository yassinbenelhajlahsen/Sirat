import { StyleSheet } from "react-native";

import { colors as themeColors, withOpacity } from "@/constants/theme";

export const notificationStyles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  headerTextBlock: {
    flexShrink: 1,
    paddingRight: 12,
  },
  headerEyebrow: {
    color: withOpacity(themeColors.accent, 0.9),
    fontSize: 11,
    fontFamily: "SFProDisplay-Semibold",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "SFProDisplay-Semibold",
    marginTop: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "SFProDisplay-Regular",
  },
  cardContainer: {
    marginTop: 14,
    marginHorizontal: 20,
    paddingBottom: 4,
  },
  prayerSectionHeader: {
    marginBottom: 10,
  },
  prayerSectionTitle: {
    fontSize: 14,
    fontFamily: "SFProDisplay-Semibold",
  },
  prayerSectionDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    fontFamily: "SFProDisplay-Regular",
  },
  rowWrapper: {
    marginBottom: 12,
    borderRadius: 12,
  },
  rowBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowSurface: {
    backgroundColor: withOpacity(themeColors.primaryDeep, 0.4),
    borderColor: withOpacity(themeColors.accent, 0.6),
    shadowColor: withOpacity(themeColors.black, 0.05),
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    overflow: "hidden",
  },
  rowLabel: {
    color: withOpacity(themeColors.white, 0.9),
    fontSize: 16,
    fontFamily: "SFProDisplay-Semibold",
    letterSpacing: 0.2,
  },
  rowLabelDisabled: {
    color: withOpacity(themeColors.white, 0.6),
  },
  rowActive: {
    backgroundColor: withOpacity(themeColors.primaryDeep, 0.4),
    borderColor: withOpacity(themeColors.accent, 0.4),
  },
  rowPressed: {
    backgroundColor: withOpacity(themeColors.primaryDeep, 0.1),
  },
  rowIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  rowIndicatorText: {
    marginLeft: 8,
    fontSize: 13,
    fontFamily: "SFProDisplay-Semibold",
    color: withOpacity(themeColors.white, 0.85),
  },
  soundCard: {
    marginTop: 14,
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
  soundSectionTitle: {
    fontSize: 16,
    fontFamily: "SFProDisplay-Semibold",
    color: themeColors.white,
  },
  soundSectionSubtitle: {
    fontSize: 12,
    fontFamily: "SFProDisplay-Regular",
    marginTop: 6,
    color: withOpacity(themeColors.white, 0.75),
  },
  soundSegmentRow: {
    flexDirection: "row",
    marginTop: 18,
    position: "relative",
  },
  soundSegment: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: withOpacity(themeColors.white, 0.05),
    borderColor: withOpacity(themeColors.white, 0.08),
  },
  soundSegmentLabel: {
    fontSize: 13,
    fontFamily: "SFProDisplay-Semibold",
  },
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
  soundDescriptionText: {
    fontSize: 12,
    fontFamily: "SFProDisplay-Regular",
    lineHeight: 18,
    color: withOpacity(themeColors.white, 0.85),
  },
  soundPreviewButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  soundPreviewText: {
    marginLeft: 8,
    fontSize: 13,
    fontFamily: "SFProDisplay-Semibold",
  },
  androidNote: {
    marginTop: 10,
    marginHorizontal: 20,
    fontSize: 12,
    fontFamily: "SFProDisplay-Regular",
  },
});

export type NotificationStyles = typeof notificationStyles;
