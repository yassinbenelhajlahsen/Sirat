import { Ionicons } from "@expo/vector-icons";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Caption } from "@/components/ui/Text";

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
      activeOpacity={0.7}
      style={styles.row}
    >
      <Ionicons name="cloud-upload-outline" size={14} color={withOpacity(colors.accent, 0.8)} style={styles.icon} />
      <Caption color={withOpacity(colors.white, 0.6)} style={styles.label}>
        Sign in to sync
      </Caption>
      <TouchableOpacity
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.dismiss}
      >
        <Ionicons name="close" size={12} color={withOpacity(colors.white, 0.35)} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      backgroundColor: withOpacity(colors.white, 0.04),
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: withOpacity(colors.primaryBorder, 0.4),
      alignSelf: "flex-start",
      marginBottom: spacing.sm,
    },
    icon: { marginRight: 5 },
    label: { fontSize: 12 },
    dismiss: { marginLeft: spacing.sm },
  });
};
