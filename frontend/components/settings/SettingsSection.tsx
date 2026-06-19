// frontend/components/settings/SettingsSection.tsx
import { ReactNode, useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SettingsSection({ label, children, style }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.wrap, style]}>
      <Caption color={withOpacity(theme.colors.accent, 0.95)} style={styles.label}>
        {label.toUpperCase()}
      </Caption>
      <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
        {children}
      </GlassSurface>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { marginTop: theme.spacing.xl },
    label: {
      letterSpacing: 1,
      marginLeft: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    card: { overflow: "hidden" },
  });
