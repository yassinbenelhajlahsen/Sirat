import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  height?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  /** Share one driver across several bars so they shimmer in step. */
  progress?: Animated.Value;
};

/** Pure-JS shimmer placeholder. Holds still when Reduce Motion is on. */
export default function SkeletonBar({ height = 16, width, style, progress }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();
  const [w, setW] = useState(0);
  const localProgress = useRef(new Animated.Value(0)).current;
  const driver = progress ?? localProgress;

  useEffect(() => {
    if (progress || reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(localProgress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, localProgress, reduceMotion]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width || 0);

  const highlightW = Math.max(60, Math.floor(w * 0.35));
  const translateX = driver.interpolate({
    inputRange: [0, 1],
    outputRange: [-highlightW, w + highlightW],
  });

  return (
    <View
      onLayout={onLayout}
      style={[styles.base, { height, borderRadius: height / 2 }, width != null && { width }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      {reduceMotion ? null : (
        <Animated.View
          pointerEvents="none"
          style={[styles.highlight, { width: highlightW, transform: [{ translateX }, { skewX: "15deg" }] }]}
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors } = theme;
  return StyleSheet.create({
    base: {
      backgroundColor: withOpacity(colors.white, 0.08),
      overflow: "hidden",
    },
    highlight: {
      position: "absolute",
      top: 0,
      bottom: 0,
      backgroundColor: withOpacity(colors.white, 0.14),
    },
  });
};
