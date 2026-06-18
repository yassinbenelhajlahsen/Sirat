import { Tabs } from "expo-router";

import GlassTabBar from "@/components/navigation/GlassTabBar";
import { useTheme } from "@/context/ThemeContext";

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: theme.colors.primaryDark },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="Quran" options={{ title: "Quran" }} />
      <Tabs.Screen name="Qibla" options={{ title: "Qibla" }} />
      <Tabs.Screen name="Mosques" options={{ title: "Mosques" }} />
      <Tabs.Screen name="Calendar" options={{ title: "Calendar" }} />
    </Tabs>
  );
}
