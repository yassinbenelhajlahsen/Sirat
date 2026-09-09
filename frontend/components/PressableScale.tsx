import { ReactNode, useCallback, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * iOS press feedback, by surface kind:
 * - `card`   a short timing scale, no bounce (cards, the hero)
 * - `button` the same scale plus an opacity dip (Button, IconButton)
 * - `row`    no transform at all, just a highlight fill (list rows, day cells)
 */
export type PressVariant = "card" | "button" | "row";

type PressableScaleProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  variant?: PressVariant;
};

const DURATION = 120;
const CARD_SCALE = 0.98;

export default function PressableScale({
  children,
  style,
  onPressIn,
  onPressOut,
  scaleTo,
  variant = "card",
  ...rest
}: PressableScaleProps) {
  const { theme } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const isRow = variant === "row";

  const animateTo = useCallback(
    (value: number) => {
      Animated.timing(progress, {
        toValue: value,
        duration: DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [progress],
  );

  const animated = useMemo<Animated.WithAnimatedObject<ViewStyle>>(() => {
    if (isRow) return {};
    const target = scaleTo ?? CARD_SCALE;
    const out: Animated.WithAnimatedObject<ViewStyle> = {
      transform: [
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, target] }) },
      ],
    };
    if (variant === "button") {
      out.opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });
    }
    return out;
  }, [isRow, progress, scaleTo, variant]);

  // Rows highlight instead of moving. The fill is an overlay rather than a
  // background on the pressable itself so a caller's own background survives.
  const radius = StyleSheet.flatten(style)?.borderRadius;

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        animateTo(1);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(0);
        onPressOut?.(event);
      }}
      style={[style, animated]}
    >
      {isRow ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              backgroundColor: withOpacity(theme.colors.white, 0.06),
              opacity: progress,
            },
          ]}
        />
      ) : null}
      {children}
    </AnimatedPressable>
  );
}
