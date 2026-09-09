// frontend/components/settings/SettingsSection.tsx
import { ReactNode, useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import SectionHeader, { SectionFooter } from "@/components/ui/SectionHeader";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  label: string;
  children: ReactNode;
  /** Explanatory text under the card, iOS grouped-list style. */
  footer?: string;
  style?: StyleProp<ViewStyle>;
};

export default function SettingsSection({ label, children, footer, style }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.wrap, style]}>
      <SectionHeader title={label} />
      <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
        {children}
      </GlassSurface>
      {footer ? <SectionFooter>{footer}</SectionFooter> : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { marginTop: theme.spacing.xxl },
    card: { overflow: "hidden" },
  });
