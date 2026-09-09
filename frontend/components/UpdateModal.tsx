import Button from "@/components/ui/Button";
import { Body, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import useModalTransition from "@/hooks/useModalTransition";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useMemo } from "react";

type UpdateModalProps = {
  visible: boolean;
  isRestarting: boolean;
  onLater: () => void;
  onRestart: () => void;
};

export default function UpdateModal({
  visible,
  isRestarting,
  onLater,
  onRestart,
}: UpdateModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { shouldRender, overlayAnimatedStyle, cardAnimatedStyle } =
    useModalTransition(visible);

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={shouldRender}
      onRequestClose={onLater}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onLater} accessibilityLabel="Dismiss" />
        <Animated.View style={[styles.card, cardAnimatedStyle]} accessibilityViewIsModal>
          <Title3 accessibilityRole="header">Update Ready</Title3>
          <Body color={theme.colors.textSecondary} style={styles.description}>
            A new version is available. Restart now to apply it.
          </Body>
          <View style={styles.buttonRow}>
            <Button label="Later" variant="tonal" onPress={onLater} style={styles.button} />
            <Button
              label="Restart"
              onPress={onRestart}
              disabled={isRestarting}
              loading={isRestarting}
              loadingLabel="Restarting..."
              style={styles.button}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLightTheme = theme.name === "light";

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xxl,
      backgroundColor: isLightTheme
        ? withOpacity(themeColors.black, 0.24)
        : withOpacity(themeColors.black, 0.58),
    },
    card: {
      borderRadius: theme.radii.card,
      borderCurve: "continuous",
      backgroundColor: isLightTheme
        ? themeColors.primaryLift
        : themeColors.primaryDeep,
      padding: theme.spacing.xl,
    },
    description: {
      marginTop: theme.spacing.sm,
    },
    buttonRow: {
      flexDirection: "row",
      marginTop: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    button: { flex: 1 },
  });
};
