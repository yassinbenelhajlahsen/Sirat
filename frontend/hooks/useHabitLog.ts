import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  HABIT_LOG_UPDATED_EVENT,
  getDayHabitDone,
  getHabitLog,
  setHabitDone,
  unwrapHabitLog,
} from "@/services/habitTracker";

export function useHabitLog(dateKey: string) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getDayHabitDone(dateKey).then((d) => {
        if (mounted) setDone(d);
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(
      HABIT_LOG_UPDATED_EVENT,
      (payload: { dateKey?: string }) => {
        if (payload?.dateKey === dateKey) reload();
      },
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [dateKey]);

  const toggle = useCallback(
    (habitId: string) => setHabitDone(dateKey, habitId, !done[habitId]),
    [dateKey, done],
  );

  return { done, toggle };
}

export function useHabitLogAll() {
  const [byDay, setByDay] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getHabitLog().then((log) => {
        if (mounted) setByDay(unwrapHabitLog(log));
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(HABIT_LOG_UPDATED_EVENT, reload);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return byDay;
}
