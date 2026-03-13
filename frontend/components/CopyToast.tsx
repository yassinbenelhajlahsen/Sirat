import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

const AUTO_DISMISS_MS = 1500;
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
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={16} color={styles.icon.color} />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;

  return StyleSheet.create({
    toast: {
      position: "absolute",
      bottom: 100,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: withOpacity(themeColors.primaryDeep, 0.95),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.35),
      shadowColor: themeColors.black,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    icon: {
      color: themeColors.accent,
    },
    message: {
      color: themeColors.white,
      fontSize: 14,
      fontWeight: "500",
    },
  });
};
