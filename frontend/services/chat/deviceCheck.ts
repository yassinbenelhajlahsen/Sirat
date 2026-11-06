// NEEDS NATIVE BUILD: DeviceCheck token for chat quota
import { requireOptionalNativeModule } from "expo-modules-core";

type NativeDeviceCheck = {
  isSupported: () => boolean;
  generateToken: () => Promise<string>;
};

// Optional probe: the module is absent in Expo Go and on Android, where the chat quota simply goes without a token.
function getNativeDeviceCheck(): NativeDeviceCheck | null {
  return requireOptionalNativeModule<NativeDeviceCheck>("SiratDeviceCheck");
}

export function hasDeviceCheckModule(): boolean {
  return getNativeDeviceCheck() !== null;
}

export async function getDeviceToken(): Promise<string | null> {
  try {
    const native = getNativeDeviceCheck();
    if (!native || !native.isSupported()) return null;
    return (await native.generateToken()) || null;
  } catch {
    return null;
  }
}
