import type { DomainAdapter } from "../types";
import type { PrayerLog } from "@/services/tracking/types";
import { getPrayerLog, replacePrayerLog } from "@/services/tracking/prayerLog";
import { mergePrayerLogs } from "@/services/tracking/merge";

export const prayerLogAdapter: DomainAdapter<PrayerLog> = {
  read: () => getPrayerLog(),
  async applyMerged(server) {
    const local = await getPrayerLog();
    await replacePrayerLog(mergePrayerLogs(local, server));
  },
};
