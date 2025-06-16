import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function TabLayout() {
  return (
        <SafeAreaProvider>
    <Tabs
        screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#FFD700",
        tabBarStyle: {
          backgroundColor: "#0c3605",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        
        sceneStyle: {
          backgroundColor: "#0c3605",
        },

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
        name="PrayerTimes"
        options={{
          tabBarIcon: ({ color }) => (
            <Image
              source={require("../../assets/images/man_praying.png")}
              style={{
                width: 24,
                height: 24,
                tintColor: color,
                borderRadius: 8,
              }}
              resizeMode="cover"
            />
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
        name="Mosques"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size} color={color} />
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



