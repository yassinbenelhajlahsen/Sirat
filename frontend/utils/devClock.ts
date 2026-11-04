import { useSyncExternalStore } from "react";

// Dev-only preview: Settings can set the time of day the app believes it is, so the next-prayer
// countdown, dial, greeting and Hijri turn at Maghrib can be checked without waiting. In memory,
// so a reload clears it. Display only: notification scheduling and storage keep the real clock.
let offsetMs = 0;
const listeners = new Set<() => void>();

/** The app's "now": the real time, shifted when a dev time is pretended. */
export function appNow(): Date {
  return new Date(Date.now() + offsetMs);
}

/** Pretend it is `hour:minute` today (the clock keeps running from there); null goes back to real time. */
export function setPretendTime(time: { hour: number; minute: number } | null): void {
  const next = __DEV__ && time ? targetOffset(time) : 0;
  if (next === offsetMs) return;
  offsetMs = next;
  for (const listener of [...listeners]) listener();
}

function targetOffset({ hour, minute }: { hour: number; minute: number }): number {
  const real = new Date();
  const target = new Date(real.getFullYear(), real.getMonth(), real.getDate(), hour, minute, 0, 0);
  // Never exactly 0 for a pretended time, so "off" stays distinguishable.
  return target.getTime() - real.getTime() || 1;
}

export function isPretendingTime(): boolean {
  return offsetMs !== 0;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Re-renders the caller when the pretended time changes; the value is only meant for effect deps. */
export function usePretendClock(): number {
  return useSyncExternalStore(subscribe, () => offsetMs);
}
