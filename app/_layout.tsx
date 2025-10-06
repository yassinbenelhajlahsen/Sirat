import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import GlobalTransition from "./components/GlobalTransition"; // add import

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "SFProDisplay-Bold": require("../assets/fonts/SF-Pro-Display-Bold.otf"),
    "SFProDisplay-Regular": require("../assets/fonts/SF-Pro-Display-Regular.otf"),
    "SFProText-Semi-Bold": require("../assets/fonts/SF-Pro-Display-Semibold.otf"),
    ...Ionicons.font,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GlobalTransition>
        <Slot />
      </GlobalTransition>
    </SafeAreaProvider>
  );
}
