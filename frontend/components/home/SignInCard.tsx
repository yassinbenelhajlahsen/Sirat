import { Ionicons } from "@expo/vector-icons";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline } from "@/components/ui/Text";

type Props = {
  onPress: () => void;
  onDismiss: () => void;
};

export default function SignInCard({ onPress, onDismiss }: Props) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Sign in to sync"
      activeOpacity={0.8}
    >
      <GlassSurface tier="row" radius={theme.radii.card} style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="sync-outline" size={22} color={colors.accent} />
        </View>
        <View style={styles.textCol}>
          <Headline color={colors.white}>Sign in to sync</Headline>
          <Caption color={withOpacity(colors.white, 0.65)} style={styles.subtitle}>
            Back up your tracker &amp; settings across devices.
          </Caption>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.dismiss}
        >
          <Ionicons name="close" size={18} color={withOpacity(colors.white, 0.5)} />
        </TouchableOpacity>
      </GlassSurface>
    </TouchableOpacity>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: withOpacity(colors.accent, 0.12),
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    textCol: { flex: 1 },
    subtitle: { marginTop: 2 },
    dismiss: { padding: spacing.sm },
  });
};
