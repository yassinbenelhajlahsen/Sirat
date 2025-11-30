import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Image } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors, withOpacity } from "../constants/theme";

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.white,
          tabBarStyle: {
            position: "absolute",
            marginHorizontal: 16,
            bottom: 24,
            height: 64,
            borderRadius: 999,
            backgroundColor: withOpacity(colors.primary, 0.9),
            borderTopWidth: 0,
            elevation: 0,
            shadowColor: colors.accent,
            shadowOpacity: 0.45,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
          },
          tabBarItemStyle: {
            paddingVertical: 10,
          },
          sceneStyle: { backgroundColor: colors.primaryDark, paddingBottom: 0 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="Mosques"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="location-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="Qibla"
          options={{
            tabBarIcon: ({ color }) => (
              <Image
                source={require("../../assets/images/qibla-compass-svgrepo-com.png")}
                style={{ width: 24, height: 24, tintColor: color }}
                resizeMode="contain"
              />
            ),
          }}
        />

        <Tabs.Screen
          name="Quran"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="Calendar"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="today-outline" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="Settings"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}
