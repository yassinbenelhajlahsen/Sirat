import type { PrayerLog, Habit, HabitLog, SettingsEnvelope } from "@/services/tracking/types";

export type SyncPayload = {
  prayer_log: PrayerLog;
  habits: Habit[];
  habit_log: HabitLog;
  settings: SettingsEnvelope;
};

export type SyncResponse = SyncPayload & { syncedAt: string };

/** A domain adapter reads the local doc and applies the server-merged doc back. */
export type DomainAdapter<T> = {
  read(): Promise<T>;
  applyMerged(serverDoc: T): Promise<void>;
};
