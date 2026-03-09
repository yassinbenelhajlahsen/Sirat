import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import useModalTransition from "@/hooks/useModalTransition";
import { Animated, Linking, Pressable, StyleSheet, Text } from "react-native";
import { useMemo } from "react";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/sirat-the-path-to-your-deen/id6753838183";

type ForceUpdateGateProps = {
  visible: boolean;
  minVersion: string;
  currentVersion: string;
};

export default function ForceUpdateGate({
  visible,
  minVersion,
  currentVersion,
}: ForceUpdateGateProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { shouldRender, overlayAnimatedStyle, cardAnimatedStyle } =
    useModalTransition(visible);

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, overlayAnimatedStyle]}
      pointerEvents="auto"
    >
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.description}>
          This version of the app is no longer supported. Please update to
          continue.
        </Text>
        {currentVersion ? (
          <Text style={styles.versionInfo}>
            Your version: {currentVersion} · Required: {minVersion}
          </Text>
        ) : null}
        <Pressable
          style={styles.updateButton}
          onPress={() => Linking.openURL(APP_STORE_URL)}
        >
          <Text style={styles.updateLabel}>Update Now</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLightTheme = theme.name === "light";

  return StyleSheet.create({
    overlay: {
      justifyContent: "center",
      paddingHorizontal: 22,
      backgroundColor: isLightTheme
        ? withOpacity(themeColors.black, 0.72)
        : withOpacity(themeColors.black, 0.88),
      zIndex: 9999,
    },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.45),
      backgroundColor: isLightTheme
        ? themeColors.primaryLift
        : themeColors.primaryDeep,
      paddingHorizontal: 18,
      paddingVertical: 22,
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
    versionInfo: {
      marginTop: 8,
      color: withOpacity(themeColors.white, 0.5),
      fontFamily: "SFProDisplay-Regular",
      fontSize: 13,
    },
    updateButton: {
      marginTop: 20,
      alignItems: "center",
      borderRadius: 12,
      paddingVertical: 13,
      backgroundColor: themeColors.accent,
    },
    updateLabel: {
      color: themeColors.onAccent,
      fontFamily: "SFProDisplay-Semibold",
      fontSize: 15,
    },
  });
};
