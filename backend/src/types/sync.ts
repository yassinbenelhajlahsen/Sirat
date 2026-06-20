/** A synced value plus a last-modified stamp (epoch-ms) for LWW conflict resolution. */
export type Cell<T> = { value: T; updatedAt: number };

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export type PrayerStatus = "prayed" | "late" | "missed";

/** dateKey ("YYYY-MM-DD") -> prayer -> status cell. */
export type PrayerLog = Record<string, Partial<Record<PrayerName, Cell<PrayerStatus>>>>;

export type HabitFrequency = { type: "daily" } | { type: "weekly"; days: number[] };
export type HabitReminder = { enabled: boolean; time?: string };

export type Habit = {
  id: string;
  name: string;
  icon: string;
  frequency: HabitFrequency;
  reminder?: HabitReminder;
  order: number;
  archived: boolean;
  createdAtKey: string;
  updatedAt: number;
  deletedAt?: number;
};

/** dateKey -> habitId -> done cell. */
export type HabitLog = Record<string, Record<string, Cell<boolean>>>;

/** settingKey -> stamped value. */
export type SettingsEnvelope = Record<string, Cell<unknown>>;

export const SYNC_DOMAINS = ["prayer_log", "habits", "habit_log", "settings"] as const;
export type SyncDomain = (typeof SYNC_DOMAINS)[number];

export type SyncPayload = {
  prayer_log?: PrayerLog;
  habits?: Habit[];
  habit_log?: HabitLog;
  settings?: SettingsEnvelope;
};

export type SyncResponse = {
  prayer_log: PrayerLog;
  habits: Habit[];
  habit_log: HabitLog;
  settings: SettingsEnvelope;
  syncedAt: string;
};
