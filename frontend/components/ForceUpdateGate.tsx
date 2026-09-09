import Button from "@/components/ui/Button";
import { Body, Footnote, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import useModalTransition from "@/hooks/useModalTransition";
import { Animated, Linking, StyleSheet } from "react-native";
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
      <Animated.View style={[styles.card, cardAnimatedStyle]} accessibilityViewIsModal>
        <Title3 accessibilityRole="header">Update Required</Title3>
        <Body color={theme.colors.textSecondary} style={styles.description}>
          This version of the app is no longer supported. Please update to
          continue.
        </Body>
        {currentVersion ? (
          <Footnote color={theme.colors.textTertiary} style={styles.versionInfo}>
            Your version: {currentVersion} · Required: {minVersion}
          </Footnote>
        ) : null}
        <Button
          label="Update Now"
          size="lg"
          icon="logo-apple-appstore"
          onPress={() => Linking.openURL(APP_STORE_URL)}
          style={styles.updateButton}
        />
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
      paddingHorizontal: theme.spacing.xxl,
      backgroundColor: isLightTheme
        ? withOpacity(themeColors.black, 0.72)
        : withOpacity(themeColors.black, 0.88),
      zIndex: 9999,
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
    versionInfo: {
      marginTop: theme.spacing.sm,
    },
    updateButton: {
      marginTop: theme.spacing.xl,
    },
  });
};
