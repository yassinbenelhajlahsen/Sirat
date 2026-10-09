import AsyncStorage from "@react-native-async-storage/async-storage";

import { APP_THEME_STORAGE_KEY } from "@/constants/theme";
import type { NormalizedAyah } from "@/services/quranData";

// Factories run when sync.ts is imported, before these consts are initialised,
// so the widget handles forward to them lazily.
const mockNextPrayer = { updateTimeline: jest.fn(), updateSnapshot: jest.fn() };
const mockPrayerTimes = { updateTimeline: jest.fn(), updateSnapshot: jest.fn() };
const mockVerse = { updateTimeline: jest.fn(), updateSnapshot: jest.fn() };
const forward = (target: () => typeof mockVerse) => ({
  __esModule: true,
  default: {
    updateTimeline: (...a: unknown[]) => (target().updateTimeline as jest.Mock)(...a),
    updateSnapshot: (...a: unknown[]) => (target().updateSnapshot as jest.Mock)(...a),
  },
});
jest.mock("@/widgets/NextPrayerWidget", () => forward(() => mockNextPrayer));
jest.mock("@/widgets/PrayerTimesWidget", () => forward(() => mockPrayerTimes));
jest.mock("@/widgets/VerseWidget", () => forward(() => mockVerse));

const mockGetPrayerTimesOn = jest.fn();
jest.mock("@/services/prayerTimes", () => ({
  getPrayerTimesOn: (...args: unknown[]) => mockGetPrayerTimesOn(...args),
}));
jest.mock("@/services/notifications/storage", () => ({
  readPrayerSettings: async () => ({ useLocation: false, method: 2, city: null }),
}));
jest.mock("@/services/notifications/cityResolver", () => ({
  canUseOSLocation: async () => false,
  deriveEffectiveSettings: (s: unknown) => s,
}));

import { readPinnedVerse } from "@/services/widgets/pinnedVerse";
import { pinVerse, syncWidgets } from "@/services/widgets/sync";

const times = (shift = 0) => [
  { label: "Fajr", time: `${5 + shift}:48 AM` },
  { label: "Sunrise", time: `${7 + shift}:02 AM` },
  { label: "Dhuhr", time: "12:43 PM" },
  { label: "Asr", time: "3:52 PM" },
  { label: "Maghrib", time: "6:21 PM" },
  { label: "Isha", time: "7:36 PM" },
];

const ayah: NormalizedAyah = {
  surahNumber: 94,
  surahNameAr: "الشرح",
  surahNameEn: "Ash-Sharh",
  juzNumber: 30,
  ayahNumber: 5,
  arabicText: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
  englishText: "Indeed, with hardship comes ease.",
};

const now = new Date(2026, 9, 9, 11, 45);

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGetPrayerTimesOn.mockImplementation(async () => times());
});

describe("syncWidgets", () => {
  it("pushes a themed timeline to both prayer widgets", async () => {
    await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "light");
    await syncWidgets(now);

    for (const widget of [mockNextPrayer, mockPrayerTimes]) {
      expect(widget.updateTimeline).toHaveBeenCalledTimes(1);
      const entries = widget.updateTimeline.mock.calls[0][0];
      expect(entries[0].date).toEqual(now);
      expect(entries[0].props.next.name).toBe("Dhuhr");
      expect(entries[0].props.theme).toMatchObject({ background: "#F5EFE6", accent: "#D4A94B" });
    }
  });

  it("reads seven days and stops at the first day without times", async () => {
    mockGetPrayerTimesOn.mockImplementation(async (d: Date) => (d.getDate() >= 12 ? [] : times()));
    await syncWidgets(now);

    const entries = mockNextPrayer.updateTimeline.mock.calls[0][0];
    const last = entries[entries.length - 1];
    expect(last.props.stale).toBe(true);
    expect(last.date).toEqual(new Date(2026, 9, 11, 19, 36));
  });

  it("asks for seven days starting today", async () => {
    await syncWidgets(now);
    const asked = mockGetPrayerTimesOn.mock.calls.map(([d]) => (d as Date).getDate());
    expect(asked).toEqual([9, 10, 11, 12, 13, 14, 15]);
  });

  it("still pushes the days it could read when a later day fails", async () => {
    mockGetPrayerTimesOn.mockImplementation(async (d: Date) => {
      if (d.getDate() >= 11) throw new Error("offline");
      return times();
    });
    await syncWidgets(now);

    const entries = mockNextPrayer.updateTimeline.mock.calls[0][0];
    const last = entries[entries.length - 1];
    expect(last.props.stale).toBe(true);
    expect(last.date).toEqual(new Date(2026, 9, 10, 19, 36));
  });

  it("does not request later days once one has failed", async () => {
    mockGetPrayerTimesOn.mockImplementation(async (d: Date) => {
      if (d.getDate() >= 11) throw new Error("offline");
      return times();
    });
    await syncWidgets(now);
    expect(mockGetPrayerTimesOn).toHaveBeenCalledTimes(3);
  });

  it("leaves the widgets alone when today's prayer times cannot be read", async () => {
    mockGetPrayerTimesOn.mockRejectedValue(new Error("offline"));
    await expect(syncWidgets(now)).resolves.toBeUndefined();
    expect(mockNextPrayer.updateTimeline).not.toHaveBeenCalled();
    expect(mockPrayerTimes.updateTimeline).not.toHaveBeenCalled();
  });

  it("shows the empty prompt on the verse widget when nothing is pinned", async () => {
    await syncWidgets(now);
    expect(mockVerse.updateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ pinned: false }),
    );
  });

  it("pushes the pinned verse with its fitted layout", async () => {
    await pinVerse(ayah);
    mockVerse.updateSnapshot.mockClear();
    await syncWidgets(now);

    expect(mockVerse.updateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        pinned: true,
        arabic: ayah.arabicText,
        english: ayah.englishText,
        reference: "Ash-Sharh 94:5",
        layouts: {
          systemMedium: { arabicSize: expect.any(Number), englishSize: expect.any(Number) },
          systemLarge: { arabicSize: expect.any(Number), englishSize: expect.any(Number) },
        },
      }),
    );
  });
});

describe("props sent to the native widget", () => {
  const hasNull = (value: unknown): boolean =>
    value === null ||
    (typeof value === "object" && Object.values(value as object).some(hasNull));

  it("never contains null, which the native side cannot convert", async () => {
    // Long enough that the English is dropped, and no Sunrise in the day.
    await pinVerse({ ...ayah, arabicText: "ك".repeat(1100), englishText: "x".repeat(1300) });
    mockGetPrayerTimesOn.mockImplementation(async () => times().filter((t) => t.label !== "Sunrise"));
    await syncWidgets(now);

    expect(mockVerse.updateSnapshot).toHaveBeenCalled();
    const snapshot = mockVerse.updateSnapshot.mock.calls.at(-1)![0];
    expect(snapshot.layouts.systemLarge.englishSize).toBe(0);
    expect(snapshot.layouts.systemMedium.englishSize).toBe(0);
    expect(hasNull(snapshot)).toBe(false);
    expect(hasNull(mockNextPrayer.updateTimeline.mock.calls.at(-1)![0])).toBe(false);
  });
});

describe("pinVerse", () => {
  it("stores the verse and replaces an earlier one", async () => {
    await pinVerse(ayah);
    await pinVerse({ ...ayah, ayahNumber: 6 });
    expect((await readPinnedVerse())?.ayahNumber).toBe(6);
  });

  it("pushes the verse to the widget right away", async () => {
    await pinVerse(ayah);
    expect(mockVerse.updateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ pinned: true, reference: "Ash-Sharh 94:5" }),
    );
  });
});
