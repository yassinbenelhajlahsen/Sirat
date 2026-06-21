import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Body, Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
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
        <View style={styles.iconTile}>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.accent} />
        </View>

        <View style={styles.text}>
          <Body color={colors.white} style={styles.title}>
            Sign in to sync
          </Body>
          <Caption color={withOpacity(colors.white, 0.6)} style={styles.subtitle}>
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
          <Ionicons name="close" size={18} color={withOpacity(colors.white, 0.4)} />
        </TouchableOpacity>
      </GlassSurface>
    </TouchableOpacity>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, radii } = theme;
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.22),
    },
    iconTile: {
      width: 42,
      height: 42,
      borderRadius: radii.chip,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.accent, 0.14),
    },
    text: { flex: 1 },
    title: { fontWeight: "600" },
    subtitle: { marginTop: 2 },
    dismiss: { alignSelf: "flex-start", padding: 2 },
  });
};
