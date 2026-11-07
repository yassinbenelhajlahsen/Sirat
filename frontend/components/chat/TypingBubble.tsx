import { useEffect, useMemo, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const CYCLE_MS = 1200;
const STAGGER_MS = 200;
const PULSE_MS = 360;
const DIM = 0.35;

export default function TypingBubble() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(DIM)));

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.parallel(
      dots.map((dot, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * STAGGER_MS),
            Animated.timing(dot, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
            Animated.timing(dot, { toValue: DIM, duration: PULSE_MS, useNativeDriver: true }),
            Animated.delay(CYCLE_MS - 2 * PULSE_MS - i * STAGGER_MS),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [dots, reduceMotion]);

  return (
    <View style={styles.bubble} accessible accessibilityLabel="Writing an answer">
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: reduceMotion ? 0.6 : dot }]} />
      ))}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    bubble: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderBottomLeftRadius: 6,
      backgroundColor: withOpacity(theme.colors.white, 0.11),
    },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.textTertiary },
  });
