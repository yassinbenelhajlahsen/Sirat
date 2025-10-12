import "dotenv/config";

export default {
  expo: {
    name: "Sirat",
    slug: "Sirat",
    version: "1.0.5",
    orientation: "portrait",
    icon: "./assets/Icon.jpg",
    splash: {
      backgroundColor: "#134b0a",
    },
    scheme: "sirat",
    userInterfaceStyle: "automatic",
    backgroundColor: "#0c3605",
    newArchEnabled: true,
    platforms: ["ios", "android"],
    ios: {
      userInterfaceStyle: "dark",
      supportsTablet: true,
      bundleIdentifier: "com.yassinbenelhajlahsen.sirat",
      buildNumber: "1.0.0",
      teamId: "5AN795CL7Z",
      infoPlist: {
        CFBundleDisplayName: "Sirat",
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "Sirat uses your location to show accurate prayer times for your area, determine the Qibla direction, and find nearby mosques.",
        NSUserNotificationsUsageDescription:
          "Sirat sends prayer time reminders and notifications you enable in the app settings.",
      },
    },
    plugins: ["expo-router", "expo-font"],
    experiments: {
      typedRoutes: true,
    },

    updates: {
      url: "https://u.expo.dev/cf8d4247-0a70-4fe4-bd59-43ea9efac019",
    },
    runtimeVersion: {
      policy: "appVersion",
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
