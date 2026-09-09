import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import AppIcon from "@/components/ui/AppIcon";
import GlassSurface from "@/components/ui/GlassSurface";
import { Footnote } from "@/components/ui/Text";

// Long enough to read at a glance without blocking anything (the toast is
// non-interactive), short enough not to linger.
const AUTO_DISMISS_MS = 2500;
const FADE_DURATION_MS = 200;

type CopyToastProps = {
  visible: boolean;
  message?: string;
  onHide: () => void;
};

export default function CopyToast({
  visible,
  message = "Copied to clipboard",
  onHide,
}: CopyToastProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }).start();

      hideTimerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_DURATION_MS,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            onHide();
          }
        });
      }, AUTO_DISMISS_MS);
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [visible, opacity, onHide]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.positioner, { opacity }]} pointerEvents="none">
      <GlassSurface tier="chrome" radius={theme.radii.pill} curve="circular" style={styles.pill}>
        <View style={styles.inner}>
          <AppIcon name="checkmark-circle" size={16} color={theme.colors.accent} />
          <Footnote color={theme.colors.white}>{message}</Footnote>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

const createStyles = (theme: AppTheme) => {
  return StyleSheet.create({
    positioner: {
      position: "absolute",
      bottom: 100,
      alignSelf: "center",
    },
    pill: {},
    inner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
  });
};
