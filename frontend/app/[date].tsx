import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DayDetailPanel from "@/components/calendar/DayDetailPanel";
import PressableScale from "@/components/PressableScale";
import Screen from "@/components/ui/Screen";
import { Headline } from "@/components/ui/Text";
import { type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useNextPrayer } from "@/hooks/useNextPrayer";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useRamadanTracker } from "@/hooks/useRamadanTracker";
import { dateKeyFromDate, getHolidayMapForYear } from "@/services/holidayService";

export default function CalendarDetail() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    date,
    month,
    year,
    holiday: holidayParam,
    ramadanStart: ramadanStartParam,
    ramadanEnd: ramadanEndParam,
  } = useLocalSearchParams();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [holiday, setHoliday] = useState<string | null>(
    typeof holidayParam === "string" && holidayParam.trim().length > 0 ? holidayParam : null,
  );

  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typeof date === "string") setSelectedDate(new Date(decodeURIComponent(date)));
  }, [date]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate) return;
      try {
        const map = await getHolidayMapForYear(selectedDate.getFullYear());
        if (mounted) setHoliday(map[dateKeyFromDate(selectedDate)] ?? null);
      } catch (e) {
        console.warn("Failed to resolve holiday:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const { prayerTimes, loading, error, retry, prayerTimesDateKey } =
    usePrayerTimes(selectedDate);
  const { nextPrayer, timeLeft } = useNextPrayer(selectedDate, prayerTimes, prayerTimesDateKey);
  const { isRamadan, isFastMissed, toggleMissedFast } = useRamadanTracker(
    selectedDate,
    ramadanStartParam,
    ramadanEndParam,
  );

  // Glass-safe horizontal day stepping: translateX only (never opacity on glass).
  const stepDay = (deltaDays: number) => {
    const current = selectedDateRef.current;
    if (!current) return;
    const next = new Date(current);
    next.setDate(next.getDate() + deltaDays);
    const dir = deltaDays > 0 ? -1 : 1;
    Animated.timing(slide, { toValue: dir * width, duration: 130, useNativeDriver: true }).start(() => {
      setSelectedDate(next);
      slide.setValue(-dir * width);
      Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
    haptics("selection");
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => slide.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        const threshold = Math.min(0.25 * width, 80);
        if (g.dx < -threshold || (g.vx < -0.8 && Math.abs(g.dx) > 20)) stepDay(1);
        else if (g.dx > threshold || (g.vx > 0.8 && Math.abs(g.dx) > 20)) stepDay(-1);
        else Animated.timing(slide, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () =>
        Animated.timing(slide, { toValue: 0, duration: 160, useNativeDriver: true }).start(),
    }),
  ).current;

  const goBack = () => {
    haptics("selection");
    router.replace(`/Calendar?month=${month}&year=${year}`);
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === "ios") await Linking.openURL("app-settings:");
      else await Linking.openSettings();
    } catch {}
  };

  if (!selectedDate) return null;
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <Screen safeArea={false}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale onPress={goBack} accessibilityRole="button" style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
          <Headline color={colors.accent}>Calendar</Headline>
        </PressableScale>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.content,
          {
            paddingBottom: insets.bottom + spacing.xxl,
            transform: [{ translateX: slide }],
          },
        ]}
      >
        <DayDetailPanel
          date={selectedDate}
          isToday={isToday}
          holiday={holiday}
          loading={loading}
          prayerTimes={prayerTimes}
          error={error}
          onRetry={retry}
          onOpenSettings={openSettings}
          nextPrayer={nextPrayer}
          timeLeft={timeLeft}
          isRamadan={isRamadan}
          isFastMissed={isFastMissed}
          onToggleMissedFast={toggleMissedFast}
        />
      </Animated.View>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: spacing.xs + 2 },
    content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  });
};
