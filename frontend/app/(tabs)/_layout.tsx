import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { Image, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors, withOpacity } from "../../constants/theme";

const ICON_SIZE = 22;

function AnimatedIconWrap({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(focused ? -6 : 0);

  useEffect(() => {
    offset.value = withSpring(focused ? -4 : 2, {
      damping: 15,
      stiffness: 150,
    });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }, { scale: focused ? 1.1 : 1 }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: withOpacity(colors.white, 0.5),
          tabBarLabelStyle: {
            fontFamily: "SFProDisplay-Semibold",
            fontSize: 10,
            marginTop: 2,
          },
          tabBarStyle: {
            position: "absolute",
            marginHorizontal: 12,
            bottom: 30,
            height: 60,
            borderRadius: 24,
            backgroundColor: withOpacity(colors.primaryDark, 0.92),
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: withOpacity(colors.accent, 0.12),
            elevation: 0,
            shadowColor: colors.black,
            shadowOpacity: 0.4,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            paddingBottom: 0,
            paddingTop: 0,
            
          },
          tabBarItemStyle: {
            justifyContent: "center",
            alignItems: "center",
          },
          sceneStyle: { backgroundColor: colors.primaryDark, paddingBottom: 0 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <AnimatedIconWrap focused={focused}>
                <Ionicons
                  name={focused ? "home" : "home-outline"}
                  size={ICON_SIZE}
                  color={color}
                />
              </AnimatedIconWrap>
            ),
          }}
        />

        <Tabs.Screen
          name="Mosques"
          options={{
            title: "Mosques",
            tabBarIcon: ({ color, focused }) => (
              <AnimatedIconWrap focused={focused}>
                <Ionicons
                  name={focused ? "location" : "location-outline"}
                  size={ICON_SIZE}
                  color={color}
                />
              </AnimatedIconWrap>
            ),
          }}
        />

        <Tabs.Screen
          name="Qibla"
          options={{
            title: "Qibla",
            tabBarIcon: ({ color, focused }) => (
              <AnimatedIconWrap focused={focused}>
                <Image
                  source={require("../../assets/images/qibla-compass-svgrepo-com.png")}
                  style={{
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    tintColor: color,
                  }}
                  resizeMode="contain"
                />
              </AnimatedIconWrap>
            ),
          }}
        />

        <Tabs.Screen
          name="Quran"
          options={{
            title: "Quran",
            tabBarIcon: ({ color, focused }) => (
              <AnimatedIconWrap focused={focused}>
                <Ionicons
                  name={focused ? "book" : "book-outline"}
                  size={ICON_SIZE}
                  color={color}
                />
              </AnimatedIconWrap>
            ),
          }}
        />

        <Tabs.Screen
          name="Calendar"
          options={{
            title: "Calendar",
            tabBarIcon: ({ color, focused }) => (
              <AnimatedIconWrap focused={focused}>
                <Ionicons
                  name={focused ? "today" : "today-outline"}
                  size={ICON_SIZE}
                  color={color}
                />
              </AnimatedIconWrap>
            ),
          }}
        />

        <Tabs.Screen
          name="Settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, focused }) => (
              <AnimatedIconWrap focused={focused}>
                <Ionicons
                  name={focused ? "settings" : "settings-outline"}
                  size={ICON_SIZE}
                  color={color}
                />
              </AnimatedIconWrap>
            ),
          }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}
