import AsyncStorage from "@react-native-async-storage/async-storage";

// Dev-only. Persisted (unlike pretend-Ramadan) because the splash only checks it at launch,
// so an in-memory switch would already be cleared by the reload that shows the splash.
export const DEV_ALWAYS_FIRST_SPLASH_KEY = "dev_always_first_splash_v1";

export async function getAlwaysFirstSplash(): Promise<boolean> {
  if (!__DEV__) return false;
  return (await AsyncStorage.getItem(DEV_ALWAYS_FIRST_SPLASH_KEY)) === "1";
}

export async function setAlwaysFirstSplash(on: boolean): Promise<void> {
  if (!__DEV__) return;
  await AsyncStorage.setItem(DEV_ALWAYS_FIRST_SPLASH_KEY, on ? "1" : "0");
}
