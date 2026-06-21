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

/** One synced setting: how to read/write its value and what event signals a change. */
export type SettingEntry = {
  /** Stable key inside the settings envelope. Never rename without a migration. */
  key: string;
  /** DeviceEventEmitter event fired when this setting changes (user or programmatic). */
  changeEvent: string;
  read(): Promise<unknown>;
  /** Persist the value AND emit `changeEvent` so consumers refresh. */
  applyValue(value: unknown): Promise<void>;
};
