import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";

export default function RootLayout() {

    const [fontsLoaded] = useFonts({
    "SFProDisplay-Bold": require("../assets/fonts/SF-Pro-Display-Bold.otf"),
    "SFProDisplay-Regular": require("../assets/fonts/SF-Pro-Display-Regular.otf"),
    "SFProText-Semi-Bold": require("../assets/fonts/SF-Pro-Display-Semibold.otf"),
  });



    if (!fontsLoaded) {
    return null; 
  }


  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
