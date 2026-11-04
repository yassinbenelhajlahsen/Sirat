import type { Cell, PrayerLog, PrayerName, PrayerStatus } from "./types";
import { createTrackerStore, isRecord } from "./trackerStore";
import { nowMs } from "./util";

export const PRAYER_LOG_STORAGE_KEY = "tracking:prayer_log_v1";
export const PRAYER_LOG_UPDATED_EVENT = "PRAYER_LOG_UPDATED";

export const prayerLogStore = createTrackerStore<PrayerLog>({
  storageKey: PRAYER_LOG_STORAGE_KEY,
  event: PRAYER_LOG_UPDATED_EVENT,
  empty: () => ({}),
  parse: (raw) => (isRecord(raw) ? (raw as PrayerLog) : {}),
});

export const getPrayerLog = () => prayerLogStore.get();
export const getCachedPrayerLog = () => prayerLogStore.peek();

export async function preloadPrayerLog(): Promise<void> {
  await prayerLogStore.get();
}

/** Marks the user has set. A cleared mark counts as not logged. */
export async function getDayStatuses(
  dateKey: string,
): Promise<Partial<Record<PrayerName, PrayerStatus>>> {
  const day = (await prayerLogStore.get())[dateKey];
  const out: Partial<Record<PrayerName, PrayerStatus>> = {};
  for (const prayer of Object.keys(day ?? {}) as PrayerName[]) {
    const status = day?.[prayer]?.value;
    if (status) out[prayer] = status;
  }
  return out;
}

async function writeCell(dateKey: string, prayer: PrayerName, cell: Cell<PrayerStatus | null>) {
  const log = await prayerLogStore.get();
  await prayerLogStore.save(
    { ...log, [dateKey]: { ...log[dateKey], [prayer]: cell } },
    { dateKey },
  );
}

export const setPrayerStatus = (dateKey: string, prayer: PrayerName, status: PrayerStatus) =>
  writeCell(dateKey, prayer, { value: status, updatedAt: nowMs() });

/**
 * Removing a mark is an edit, not a deletion: it is stored as a time-stamped empty cell so the
 * removal wins the merge and reaches every device.
 */
export async function clearPrayerStatus(dateKey: string, prayer: PrayerName): Promise<void> {
  const current = (await prayerLogStore.get())[dateKey]?.[prayer];
  if (!current || current.value === null) return;
  await writeCell(dateKey, prayer, { value: null, updatedAt: nowMs() });
}

export const replacePrayerLog = (log: PrayerLog) => prayerLogStore.save(log, { dateKey: null });
