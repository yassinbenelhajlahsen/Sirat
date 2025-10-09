import { memo } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  textColor?: string;
  accentColor?: string;
  tabBarHeight?: number;
  gapAboveTab?: number;
};

function SupportFooter({
  textColor = "#ffffff",
  accentColor = "#DABA69",
}: Props) {
  const insets = useSafeAreaInsets();
  const footerBottom = insets.bottom;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: footerBottom,
        alignItems: "center",
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Open Sirat website"
        onPress={() => Linking.openURL("https://sirat.dev").catch(() => {})}
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 6,
          maxWidth: "92%",
        }}
      >
        <Text style={{ color: textColor, fontSize: 13, textAlign: "center" }}>
          Questions?{" "}
          <Text
            style={{
              color: accentColor,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Visit our site!
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}

export default memo(SupportFooter);
