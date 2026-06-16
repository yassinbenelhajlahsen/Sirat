import { Tabs } from "expo-router";
import { Dimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import GlassTabBar from "@/components/navigation/GlassTabBar";
import { useTheme } from "@/context/ThemeContext";

const SCREEN_W = Dimensions.get("window").width;

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <SafeAreaProvider>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          sceneStyle: { backgroundColor: theme.colors.primaryDark },
          transitionSpec: { animation: "timing", config: { duration: 260 } },
          sceneStyleInterpolator: ({ current }) => ({
            sceneStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [-1, 0, 1],
                    // flip sign if slide direction feels reversed
                    outputRange: [SCREEN_W, 0, -SCREEN_W],
                  }),
                },
              ],
            },
          }),
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="Quran" options={{ title: "Quran" }} />
        <Tabs.Screen name="Qibla" options={{ title: "Qibla" }} />
        <Tabs.Screen name="Mosques" options={{ title: "Mosques" }} />
        <Tabs.Screen name="Calendar" options={{ title: "Calendar" }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
