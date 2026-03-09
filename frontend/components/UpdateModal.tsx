import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import useModalTransition from "@/hooks/useModalTransition";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
        <Pressable style={StyleSheet.absoluteFill} onPress={onLater} />
        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          <Text style={styles.title}>Update Ready</Text>
          <Text style={styles.description}>
            A new version is available. Restart now to apply it.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable style={styles.laterButton} onPress={onLater}>
              <Text style={styles.laterLabel}>Later</Text>
            </Pressable>
            <Pressable
              style={[styles.restartButton, isRestarting && styles.buttonDisabled]}
              onPress={onRestart}
              disabled={isRestarting}
            >
              <Text style={styles.restartLabel}>
                {isRestarting ? "Restarting..." : "Restart"}
              </Text>
            </Pressable>
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
      paddingHorizontal: 22,
      backgroundColor: isLightTheme
        ? withOpacity(themeColors.black, 0.24)
        : withOpacity(themeColors.black, 0.58),
    },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.45),
      backgroundColor: isLightTheme
        ? themeColors.primaryLift
        : themeColors.primaryDeep,
      paddingHorizontal: 18,
      paddingVertical: 18,
    },
    title: {
      color: themeColors.white,
      fontFamily: "SFProDisplay-Bold",
      fontSize: 20,
    },
    description: {
      marginTop: 10,
      color: withOpacity(themeColors.white, 0.78),
      fontFamily: "SFProDisplay-Regular",
      fontSize: 15,
      lineHeight: 21,
    },
    buttonRow: {
      flexDirection: "row",
      marginTop: 18,
      gap: 10,
    },
    laterButton: {
      flex: 1,
      alignItems: "center",
      borderRadius: 12,
      paddingVertical: 12,
      backgroundColor: isLightTheme
        ? themeColors.primarySurfaceAlt
        : withOpacity(themeColors.white, 0.08),
    },
    laterLabel: {
      color: themeColors.white,
      fontFamily: "SFProDisplay-Semibold",
      fontSize: 15,
    },
    restartButton: {
      flex: 1,
      alignItems: "center",
      borderRadius: 12,
      paddingVertical: 12,
      backgroundColor: themeColors.accent,
    },
    restartLabel: {
      color: themeColors.onAccent,
      fontFamily: "SFProDisplay-Semibold",
      fontSize: 15,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
  });
};
