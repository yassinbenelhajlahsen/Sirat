import type { DomainAdapter } from "../types";
import type { HabitLog } from "@/services/tracking/types";
import { getHabitLog, replaceHabitLog } from "@/services/tracking/habitLog";
import { mergeHabitLogs } from "@/services/tracking/merge";

export const habitLogAdapter: DomainAdapter<HabitLog> = {
  read: () => getHabitLog(),
  async applyMerged(server) {
    const local = await getHabitLog();
    await replaceHabitLog(mergeHabitLogs(local, server));
  },
};
