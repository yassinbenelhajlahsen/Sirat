import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { BottomSheetBackgroundProps } from "@gorhom/bottom-sheet";

import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Props = BottomSheetBackgroundProps & {
  testID?: string;
  fadeToSolidFrom?: number;
};

// Real iOS 26 liquid glass over the map at peek/half (translucent fallback
// elsewhere), with a solid vertical gradient that fades in toward full. Only
// the gradient overlay animates — never the glass — so the material keeps
// rendering (animating a GlassView's opacity stops it drawing).
export default function SheetBackground({
  style,
  animatedIndex,
  testID,
  fadeToSolidFrom = 1,
}: Props) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const glass = Platform.OS === "ios" && isGlassEffectAPIAvailable();

  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [fadeToSolidFrom, fadeToSolidFrom + 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[style, styles.bg, { borderColor: withOpacity(colors.white, 0.12) }]}
    >
      {glass ? (
        <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withOpacity(colors.primaryDeep, 0.82) },
          ]}
        />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
        <LinearGradient
          colors={[colors.primaryDeep, colors.primary]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    overflow: "hidden",
  },
});
