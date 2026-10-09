// ---------------------------------------------------------------------------
// NEEDS NATIVE BUILD — changes queued for the next EAS binary
//
// `runtimeVersion.policy` is "appVersion", so an OTA update only reaches the
// binary whose `version` matches. Do NOT bump `version` for a JS-only release;
// bump it (and rebuild) only when one of these lands:
//
//
// Search the codebase for "NEEDS NATIVE BUILD" to find every call site that
// was written around the current native build.
// ---------------------------------------------------------------------------
export default {
  expo: {
    name: "Sirat",
    slug: "Sirat",
    version: "1.2.0",
    orientation: "portrait",
    icon: "./assets/Icon.jpg",
    splash: {
      backgroundColor: "#0E1117",
    },
    scheme: "sirat",
    userInterfaceStyle: "automatic",
    backgroundColor: "#0E1117",
    platforms: ["ios", "android"],
    ios: {
      // The in-app theme drives the OS color scheme (context/ThemeContext.tsx).
      userInterfaceStyle: "automatic",
      supportsTablet: true,
      bundleIdentifier: "com.yassinbenelhajlahsen.sirat",
      teamId: "5AN795CL7Z",
      infoPlist: {
        CFBundleDisplayName: "Sirat",
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "Sirat uses your location to show accurate prayer times for your area, determine the Qibla direction, and find nearby mosques.",
        NSUserNotificationsUsageDescription:
          "Sirat sends prayer time reminders and notifications you enable in the app settings.",
        UIBackgroundModes: ["audio"],
      },
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-audio",
      [
        "expo-notifications",
        {
          sounds: [
            "./assets/sounds/adhan.caf",
          ],
        },
      ],
      // Alternate app icons matched to in-app themes. iOS-only by design.
      // Names are PascalCase to match what setAlternateAppIcon expects.
      // NOTE: this plugin also adds Android activity-aliases referencing
      // @mipmap/ic_launcher_dark|light — Android builds would need adaptive
      // icon assets added here before they will compile.
      [
        "expo-alternate-app-icons",
        [
          { name: "Dark", ios: "./assets/icons/icon-dark.png" },
          { name: "Light", ios: "./assets/icons/icon-light.png" },
        ],
      ],
      // Adds the widget extension target and App Group.
      [
        "expo-widgets",
        {
          widgets: [
            {
              name: "NextPrayer",
              displayName: "Next prayer",
              description: "The next prayer, its time, and the time remaining.",
              ios: { supportedFamilies: ["accessoryRectangular", "systemSmall"] },
            },
            {
              name: "PrayerTimes",
              displayName: "Prayer times",
              description: "Today's five prayers and the time until the next one.",
              ios: { supportedFamilies: ["systemMedium", "systemLarge"] },
            },
            {
              name: "Verse",
              displayName: "Verse",
              description: "A verse you picked in the Quran tab.",
              ios: { supportedFamilies: ["systemMedium", "systemLarge"] },
            },
          ],
        },
      ],
      "expo-secure-store",
      "@clerk/expo",
      "expo-apple-authentication",
    ],
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
      router: {},
      eas: {
        projectId: "cf8d4247-0a70-4fe4-bd59-43ea9efac019",
      },
    },
  },
};
