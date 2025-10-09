// app.config.js
import "dotenv/config";

export default {
  expo: {
    name: "Sirat",
    slug: "Sirat",
    version: "1.0.3",
    orientation: "portrait",
    icon: "./assets/Icon.jpg",
    splash: {
      backgroundColor: "#134b0a",
    },
    scheme: "sirat",
    userInterfaceStyle: "automatic",
    backgroundColor: "#0c3605",
    newArchEnabled: true,
    ios: {
      userInterfaceStyle: "dark",
      supportsTablet: true,
      bundleIdentifier: "com.yassinbenelhajlahsen.sirat",
      buildNumber: "1.0.0",
      infoPlist: {
        CFBundleDisplayName: "Sirat",
      },
      teamId: "5AN795CL7Z",
    },
    plugins: ["expo-router", "expo-font"],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      fullName: "Sirat - The Path to Your Deen",
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      router: {},
      eas: {
        projectId: "cf8d4247-0a70-4fe4-bd59-43ea9efac019",
      },
    },
  },
};
