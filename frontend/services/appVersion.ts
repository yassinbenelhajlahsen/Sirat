import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? Updates.runtimeVersion ?? "0.0.0";
}

export function getAppPlatform(): string {
  return Platform.OS;
}

export function getVersionHeaders(): Record<string, string> {
  return {
    "x-sirat-app-version": getAppVersion(),
    "x-sirat-platform": getAppPlatform(),
    "x-sirat-app-ownership": Constants.appOwnership ?? "unknown",
  };
}
