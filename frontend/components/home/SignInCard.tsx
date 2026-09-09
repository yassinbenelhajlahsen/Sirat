import { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import AppIcon from "@/components/ui/AppIcon";
import GlassSurface from "@/components/ui/GlassSurface";
import { Body, Caption } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  onPress: () => void;
  onDismiss: () => void;
};

export default function SignInCard({ onPress, onDismiss }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Sign in to sync"
      activeOpacity={0.85}
    >
      <GlassSurface tier="row" radius={theme.radii.card} style={styles.card}>
        <AppIcon name="cloud-upload-outline" size={20} color={colors.accent} />

        <View style={styles.text}>
          <Body color={colors.white} style={styles.title}>
            Sign in to sync
          </Body>
          <Caption color={colors.textTertiary} style={styles.subtitle}>
            Back up your tracker &amp; settings across devices.
          </Caption>
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.dismiss}
        >
          <AppIcon name="close" size={18} color={colors.iconMuted} />
        </TouchableOpacity>
      </GlassSurface>
    </TouchableOpacity>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    text: { flex: 1 },
    title: { fontWeight: "600" },
    subtitle: { marginTop: 2 },
    dismiss: { alignSelf: "flex-start", padding: 2 },
  });
};
