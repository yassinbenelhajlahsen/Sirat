import { StyleSheet } from "react-native";

import type { AppTheme } from "@/constants/theme";

/** The little that is left after the notification panel became iOS groups. */
export function getNotificationStyles(theme: AppTheme) {
  const { spacing } = theme;
  return StyleSheet.create({
    dimmed: { opacity: 0.55 },
    segmentRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    soundTrailing: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    previewAction: { fontWeight: "600" },
  });
}
