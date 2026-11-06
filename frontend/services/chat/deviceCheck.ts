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

// A hung DeviceCheck call must not hold up the reply: the send goes without a token instead.
const TOKEN_TIMEOUT_MS = 5000;

export async function getDeviceToken(): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS);
  });
  try {
    const native = getNativeDeviceCheck();
    if (!native || !native.isSupported()) return null;
    return await Promise.race([native.generateToken().then((token) => token || null), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
