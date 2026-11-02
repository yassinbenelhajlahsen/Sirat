import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import IconButton from "@/components/ui/IconButton";
import { Headline } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
};

/** iOS-style sheet header: short centered title, one close button in the corner. */
export default function SheetTitleBar({ title, onClose, closeLabel = "Close", closeDisabled = false }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.bar}>
      <Headline accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Headline>
      <IconButton
        icon="close"
        variant="glass"
        size={36}
        iconSize={16}
        accessibilityLabel={closeLabel}
        onPress={onClose}
        disabled={closeDisabled}
        style={styles.close}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    bar: {
      minHeight: 60,
      justifyContent: "center",
      paddingHorizontal: 60,
      paddingTop: theme.spacing.sm,
    },
    title: { textAlign: "center" },
    close: {
      position: "absolute",
      right: theme.spacing.lg,
      top: theme.spacing.lg,
    },
  });
