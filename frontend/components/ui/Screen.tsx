import { ReactNode } from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

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
      <View pointerEvents="none" style={styles.pattern}>
        <Image
          source={require("@/assets/patterns/islamic-gold2.png")}
          style={styles.patternImage}
        />
      </View>
      {safeArea ? <SafeAreaView style={styles.fill}>{inner}</SafeAreaView> : inner}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pattern: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  patternImage: { width: "100%", height: "100%", opacity: 0.04, resizeMode: "repeat" },
});
