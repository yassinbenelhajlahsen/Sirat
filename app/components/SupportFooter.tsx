import { memo } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  textColor?: string;
  accentColor?: string;
  tabBarHeight?: number;
  gapAboveTab?: number;
};

function SupportFooter({
  textColor = "#FFFFFF",
  accentColor = "#DABA69",
  tabBarHeight = 0,
  gapAboveTab = 8,
}: Props) {
  const insets = useSafeAreaInsets();
  const footerBottom = insets.bottom + tabBarHeight + gapAboveTab;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: footerBottom,
        alignItems: "center",
        paddingHorizontal: 16,
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessible
        accessibilityLabel="Open Sirat website"
        accessibilityHint="Opens the Sirat website in your browser"
        onPress={() => Linking.openURL("https://sirat.dev").catch(() => {})}
        android_ripple={{ color: "rgba(255,255,255,0.06)", borderless: false }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.03)",
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
          maxWidth: 520,
          width: "100%",
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: textColor,
              fontSize: 13,
              lineHeight: 18,
              fontFamily:
                Platform.OS === "ios" ? "SFProDisplay-Semibold" : undefined,
              letterSpacing: 0.2,
              marginRight: 8,
            }}
          >
            Visit our site
          </Text>

          <Text
            style={{
              color: accentColor,
              fontSize: 13,
              lineHeight: 18,
              fontFamily:
                Platform.OS === "ios" ? "SFProDisplay-Semibold" : undefined,
              opacity: 0.95,
            }}
          >
            ↗
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default memo(SupportFooter);
