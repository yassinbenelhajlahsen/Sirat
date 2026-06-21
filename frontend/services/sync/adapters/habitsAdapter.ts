import type { DomainAdapter } from "../types";
import type { Habit } from "@/services/tracking/types";
import { getAllHabits, replaceAllHabits } from "@/services/tracking/habits";
import { mergeHabits } from "@/services/tracking/merge";

export const habitsAdapter: DomainAdapter<Habit[]> = {
  read: () => getAllHabits(),
  async applyMerged(server) {
    const local = await getAllHabits();
    await replaceAllHabits(mergeHabits(local, server));
  },
};
