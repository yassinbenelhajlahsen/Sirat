import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  HABITS_UPDATED_EVENT,
  createHabit,
  deleteHabit,
  getActiveHabits,
  reorderHabits,
  updateHabit,
  type Habit,
  type HabitFrequency,
  type HabitReminder,
} from "@/services/habitTracker";

type UpdatePatch = Partial<
  Pick<Habit, "name" | "icon" | "frequency" | "reminder" | "archived" | "order">
>;

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getActiveHabits().then((h) => {
        if (mounted) setHabits(h);
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(HABITS_UPDATED_EVENT, reload);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

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
