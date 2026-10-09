// NEEDS NATIVE BUILD: importing the widgets loads the ExpoWidgets native module,
// which only exists in binaries built from app.config.js version 1.2.0 or later.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { APP_THEME_STORAGE_KEY } from "@/constants/theme";
import type { NormalizedAyah } from "@/services/quranData";
import { canUseOSLocation, deriveEffectiveSettings } from "@/services/notifications/cityResolver";
import { readPrayerSettings } from "@/services/notifications/storage";
import { getPrayerTimesOn } from "@/services/prayerTimes";
import NextPrayer from "@/widgets/NextPrayerWidget";
import PrayerTimes from "@/widgets/PrayerTimesWidget";
import Verse from "@/widgets/VerseWidget";

import { readPinnedVerse, writePinnedVerse } from "./pinnedVerse";
import { buildPrayerTimeline, type WidgetDay } from "./timeline";
import { fitVerse } from "./verseFit";
import { widgetTheme } from "./widgetTheme";

// Cautious: iOS timeline entry limits are unverified. Raise once a device build shows more is safe.
const HORIZON_DAYS = 7;

const readTheme = async () => widgetTheme(await AsyncStorage.getItem(APP_THEME_STORAGE_KEY));

async function syncPrayerWidgets(now: Date) {
  const settings = deriveEffectiveSettings(await readPrayerSettings(), await canUseOSLocation());
  // One day at a time, today first: a day missing from the cache starts a yearly
  // fetch, and seven of those at once is wasteful. A later day failing only
  // shortens the timeline; today failing leaves the widgets as they were.
  const days: WidgetDay[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    try {
      const times = await getPrayerTimesOn(date, settings);
      days.push({ date, times });
      if (times.length === 0) break;
    } catch (error) {
      if (i === 0) throw error;
      break;
    }
  }
  const theme = await readTheme();
  const entries = buildPrayerTimeline(days, now).map((e) => ({
    date: e.date,
    props: { ...e.props, theme },
  }));
  NextPrayer.updateTimeline(entries);
  PrayerTimes.updateTimeline(entries);
}

export async function syncVerseWidget() {
  const [ayah, theme] = await Promise.all([readPinnedVerse(), readTheme()]);
  if (!ayah) {
    Verse.updateSnapshot({ pinned: false, theme });
    return;
  }
  const layout = fitVerse(ayah.arabicText, ayah.englishText);
  Verse.updateSnapshot({
    pinned: true,
    arabic: ayah.arabicText,
    english: ayah.englishText,
    reference: `${ayah.surahNameEn} ${ayah.surahNumber}:${ayah.ayahNumber}`,
    arabicSize: layout.arabicSize,
    englishSize: layout.englishSize,
    surah: ayah.surahNumber,
    ayah: ayah.ayahNumber,
    theme,
  });
}

/** One verse at a time: pinning another replaces it. */
export async function pinVerse(ayah: NormalizedAyah): Promise<void> {
  await writePinnedVerse(ayah);
  await syncVerseWidget();
}

/** Pushes everything the widgets show. Never throws: a failed sync keeps the last data. */
export async function syncWidgets(now = new Date()): Promise<void> {
  const results = await Promise.allSettled([syncPrayerWidgets(now), syncVerseWidget()]);
  for (const r of results) {
    if (r.status === "rejected") console.warn("Widget sync failed", r.reason);
  }
}
