export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_NAMES: readonly PrayerName[] = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

export type PrayerStatus = "prayed" | "late" | "missed";

/** A synced value plus a last-modified stamp (epoch-ms) for LWW conflict resolution. */
export type Cell<T> = { value: T; updatedAt: number };

/** dateKey ("YYYY-MM-DD") -> prayer -> status cell. */
export type PrayerLog = Record<
  string,
  Partial<Record<PrayerName, Cell<PrayerStatus>>>
>;

export type HabitFrequency =
  | { type: "daily" }
  | { type: "weekly"; days: number[] };

export type HabitReminder = { enabled: boolean; time?: string };

export type Habit = {
  id: string;
  name: string;
  icon: string; // Ionicons glyph name
  frequency: HabitFrequency;
  reminder?: HabitReminder;
  order: number;
  archived: boolean;
  createdAtKey: string;
  updatedAt: number;
  deletedAt?: number; // tombstone for hard delete
};

/** dateKey -> habitId -> done cell. */
export type HabitLog = Record<string, Record<string, Cell<boolean>>>;

/** settingKey -> stamped value. Mirrors backend SettingsEnvelope. */
export type SettingsEnvelope = Record<string, Cell<unknown>>;
