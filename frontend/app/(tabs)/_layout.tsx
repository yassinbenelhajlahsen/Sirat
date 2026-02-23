import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors, withOpacity } from "../../constants/theme";

const ICON_SIZE = 22;

type TabGlyphProps = {
  focused: boolean;
  children: ReactNode;
};

function TabGlyph({ focused, children }: TabGlyphProps) {
  return (
    <View style={styles.iconShell}>
      <View style={[styles.iconBubble, focused ? styles.iconBubbleActive : undefined]}>
        {children}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: withOpacity(colors.white, 0.74),
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarHideOnKeyboard: true,
          sceneStyle: { backgroundColor: colors.primaryDark, paddingBottom: 0 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <TabGlyph focused={focused}>
                <Ionicons
                  name={focused ? "home" : "home-outline"}
                  size={ICON_SIZE}
                  color={focused ? colors.primaryDeep : color}
                />
              </TabGlyph>
            ),
          }}
        />

        <Tabs.Screen
          name="Mosques"
          options={{
            title: "Mosques",
            tabBarIcon: ({ color, focused }) => (
              <TabGlyph focused={focused}>
                <Ionicons
                  name={focused ? "location" : "location-outline"}
                  size={ICON_SIZE}
                  color={focused ? colors.primaryDeep : color}
                />
              </TabGlyph>
            ),
          }}
        />

        <Tabs.Screen
          name="Qibla"
          options={{
            title: "Qibla",
            tabBarIcon: ({ color, focused }) => (
              <TabGlyph focused={focused}>
                <Image
                  source={require("../../assets/images/qibla-compass-svgrepo-com.png")}
                  style={[
                    styles.qiblaIcon,
                    { tintColor: focused ? colors.primaryDeep : color },
                  ]}
                  resizeMode="contain"
                />
              </TabGlyph>
            ),
          }}
        />

        <Tabs.Screen
          name="Quran"
          options={{
            title: "Quran",
            tabBarIcon: ({ color, focused }) => (
              <TabGlyph focused={focused}>
                <Ionicons
                  name={focused ? "book" : "book-outline"}
                  size={ICON_SIZE}
                  color={focused ? colors.primaryDeep : color}
                />
              </TabGlyph>
            ),
          }}
        />

        <Tabs.Screen
          name="Calendar"
          options={{
            title: "Calendar",
            tabBarIcon: ({ color, focused }) => (
              <TabGlyph focused={focused}>
                <Ionicons
                  name={focused ? "today" : "today-outline"}
                  size={ICON_SIZE}
                  color={focused ? colors.primaryDeep : color}
                />
              </TabGlyph>
            ),
          }}
        />

        <Tabs.Screen
          name="Settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, focused }) => (
              <TabGlyph focused={focused}>
                <Ionicons
                  name={focused ? "settings" : "settings-outline"}
                  size={ICON_SIZE}
                  color={focused ? colors.primaryDeep : color}
                />
              </TabGlyph>
            ),
          }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    marginHorizontal: 14,
    bottom: 20,
    height: 56,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 999,
    backgroundColor: withOpacity(colors.primaryDeep, 0.93),
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: withOpacity(colors.white, 0.1),
    elevation: 0,
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 0,
  },
  iconShell: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleActive: {
    backgroundColor: withOpacity(colors.accent, 0.95),
  },

  qiblaIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
});
