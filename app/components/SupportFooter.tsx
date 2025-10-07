import React, { memo } from "react";
import { Pressable, Text, View, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  email?: string;
  textColor?: string;
  accentColor?: string;
  tabBarHeight?: number; 
  gapAboveTab?: number;  
};

function SupportFooter({
  email = "yassinbenelhajlahsen@gmail.com",
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
        accessibilityLabel="Contact support via email"
        onPress={() =>
          Linking.openURL(`mailto:${email}`).catch(() => {})
        }
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
          Questions? Email:{" "}
          <Text
            style={{
              color: accentColor,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            {email}
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}

export default memo(SupportFooter);
