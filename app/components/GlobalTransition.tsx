import { usePathname } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Direction = "forward" | "back" | "replace" | "jump";

const DURATION = 380;
const EASING = Easing.out(Easing.cubic);

// A very small global-ish store that lives for the app session.
// Using a ref inside the component keeps it instance-local but persists
// for the lifetime of the root layout (which is what we want).
function computeDirection(
  stack: string[],
  nextPath: string,
): { direction: Direction; nextStack: string[] } {
  if (stack.length === 0) return { direction: "forward", nextStack: [nextPath] };

  const top = stack[stack.length - 1];
  if (nextPath === top) {
    // No real navigation—return existing stack
    return { direction: "replace", nextStack: stack };
  }

  // Back one?
  if (stack.length > 1 && nextPath === stack[stack.length - 2]) {
    const copy = stack.slice(0, -1);
    return { direction: "back", nextStack: copy };
  }

  // Jump back multiple?
  const idx = stack.indexOf(nextPath);
  if (idx !== -1 && idx < stack.length - 1) {
    const copy = stack.slice(0, idx + 1);
    return { direction: "jump", nextStack: copy };
  }

  // Otherwise it's a brand-new forward push.
  return { direction: "forward", nextStack: [...stack, nextPath] };
}

export default function GlobalTransition({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const pathname = usePathname();

  // Motion values
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  // History + settings refs
  const historyRef = useRef<string[]>([pathname]);
  const lastPathRef = useRef(pathname);
  const reduceMotionRef = useRef(false);

  // Keep Reduced Motion in sync
  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) reduceMotionRef.current = !!v;
    });

    const sub =
      Platform.OS !== "web"
        ? AccessibilityInfo.addEventListener(
            "reduceMotionChanged",
            (v: boolean) => {
              reduceMotionRef.current = !!v;
            }
          )
        : null;

    return () => {
      mounted = false;
      // @ts-expect-error RN types differ by version
      sub?.remove?.();
    };
  }, []);

  // Run an animation when the path actually changes
  useEffect(() => {
    if (pathname === lastPathRef.current) return;

    const { direction, nextStack } = computeDirection(
      historyRef.current,
      pathname
    );
    historyRef.current = nextStack;

    // Cancel any ongoing transition to avoid jitter on quick navs
    cancelAnimation(translateX);
    cancelAnimation(opacity);

    // If user prefers reduced motion: snap without animating
    if (reduceMotionRef.current) {
      translateX.value = 0;
      opacity.value = 1;
      lastPathRef.current = pathname;
      return;
    }

    // Choose an offset based on direction
    let startX = 0;
    switch (direction) {
      case "forward":
        startX = 60;
        break;
      case "back":
      case "jump": // treat multi-step back similar to back
        startX = -60;
        break;
      case "replace":
        startX = 0;
        break;
    }

    // Start state
    translateX.value = startX;
    opacity.value = direction === "replace" ? 0.6 : 0.4;

    // Animate to rest
    translateX.value = withTiming(0, { duration: DURATION, easing: EASING });
    opacity.value = withTiming(1, { duration: DURATION, easing: EASING }, () =>
      runOnJS(() => {
        // After the animation finishes, record the path
        lastPathRef.current = pathname;
      })
    );
  }, [pathname]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Keep this background truly global; modals still render above.
    backgroundColor: "#0c3605",
  },
});
