import { useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter, type EmitterSubscription } from "react-native";
import { useAuthState } from "@/hooks/useAuthState";
import { syncNow, isApplyingRemote } from "@/services/sync/syncEngine";
import { SETTINGS_REGISTRY } from "@/services/sync/settingsRegistry";
import { bumpStamp } from "@/services/sync/settingsMeta";
import { PRAYER_LOG_UPDATED_EVENT } from "@/services/tracking/prayerLog";
import { HABIT_LOG_UPDATED_EVENT } from "@/services/tracking/habitLog";
import { HABITS_UPDATED_EVENT } from "@/services/tracking/habits";

const DEBOUNCE_MS = 4000;
const TRACKER_EVENTS = [PRAYER_LOG_UPDATED_EVENT, HABIT_LOG_UPDATED_EVENT, HABITS_UPDATED_EVENT];

export function useSyncEngine(): void {
  const { isSignedIn } = useAuthState();
  const wasSignedIn = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedInRef = useRef(isSignedIn);
  signedInRef.current = isSignedIn;

  // Sign-in transition.
  useEffect(() => {
    if (isSignedIn && !wasSignedIn.current) void syncNow("signin");
    wasSignedIn.current = isSignedIn;
  }, [isSignedIn]);

  // Foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && signedInRef.current) void syncNow("foreground");
    });
    return () => sub.remove();
  }, []);

  // Change events: stamp settings + debounced sync.
  useEffect(() => {
    const scheduleSync = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        debounce.current = null;
        if (signedInRef.current) void syncNow("change");
      }, DEBOUNCE_MS);
    };

    const subs: EmitterSubscription[] = [];

    for (const evt of TRACKER_EVENTS) {
      subs.push(DeviceEventEmitter.addListener(evt, () => {
        if (isApplyingRemote()) return;
        scheduleSync();
      }));
    }
    for (const entry of SETTINGS_REGISTRY) {
      subs.push(DeviceEventEmitter.addListener(entry.changeEvent, () => {
        if (isApplyingRemote()) return;
        void bumpStamp(entry.key);
        scheduleSync();
      }));
    }

    return () => {
      subs.forEach((s) => s.remove());
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);
}
