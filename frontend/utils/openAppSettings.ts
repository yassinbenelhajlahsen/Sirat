import { Linking, Platform } from "react-native";

export async function openAppSettings(): Promise<void> {
  try {
    if (Platform.OS === "ios") await Linking.openURL("app-settings:");
    else await Linking.openSettings();
  } catch {
    // Nothing to recover: the user can still open Settings by hand.
  }
}
