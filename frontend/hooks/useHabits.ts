import { useCallback } from "react";

import { useTrackerData } from "@/hooks/useTrackerData";
import {
  createHabit,
  deleteHabit,
  activeHabits,
  habitsStore,
  reorderHabits,
  updateHabit,
  type Habit,
  type HabitFrequency,
  type HabitReminder,
} from "@/services/habitTracker";

type UpdatePatch = Partial<
  Pick<Habit, "name" | "icon" | "frequency" | "reminder" | "archived" | "order">
>;

const NONE: Habit[] = [];

export function useHabits() {
  const habits = useTrackerData(habitsStore, activeHabits, NONE);

  const create = useCallback(
    (input: { name: string; icon: string; frequency: HabitFrequency; reminder?: HabitReminder }) =>
      createHabit(input),
    [],
  );
  const update = useCallback((id: string, patch: UpdatePatch) => updateHabit(id, patch), []);
  const archive = useCallback((id: string) => updateHabit(id, { archived: true }), []);
  const remove = useCallback((id: string) => deleteHabit(id), []);
  const reorder = useCallback((orderedIds: string[]) => reorderHabits(orderedIds), []);

  return { habits, create, update, archive, remove, reorder };
}
