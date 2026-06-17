import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import Aurora from "@/components/ui/Aurora";
import { useTheme } from "@/context/ThemeContext";

type ScreenProps = {
  children: ReactNode;
  /** when false, content is not wrapped in SafeAreaView (e.g., full-bleed maps) */
  safeArea?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Screen({ children, safeArea = true, style }: ScreenProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const inner = <View style={[styles.fill, style]}>{children}</View>;

  return (
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <Aurora />
      {safeArea ? <SafeAreaView style={styles.fill}>{inner}</SafeAreaView> : inner}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
