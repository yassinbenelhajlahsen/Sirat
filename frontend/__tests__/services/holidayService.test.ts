import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearHolidayCache,
  dateKeyFromDate,
  getHolidayMapForYear,
  getHolidaysForYear,
} from "@/services/holidayService";

describe("services/holidayService", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearHolidayCache();
    (global.fetch as jest.Mock).mockReset();
  });

  it("sanitizes backend payload by dropping invalid rows, trimming names, de-duplicating dates, and sorting", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          holidays: [
            { date: "2026-03-01", name: "  Ramadan starts  " },
            { date: "2026-03-01", name: "Duplicate should be ignored" },
            { date: "2026-03-10", name: "   " },
            { date: "bad-date", name: "Invalid date" },
            { date: "2026-02-28", name: "Prep day" },
            null,
            "bad",
          ],
        },
      }),
    });

    const holidays = await getHolidaysForYear(2026);

    expect(holidays).toEqual([
      { date: "2026-02-28", name: "Prep day" },
      { date: "2026-03-01", name: "Ramadan starts" },
    ]);
  });

  it("uses local date parts for dateKeyFromDate", () => {
    const date = new Date(2026, 1, 5, 23, 59, 59);
    expect(dateKeyFromDate(date)).toBe("2026-02-05");
  });

  it("reuses in-memory cache and avoids repeated fetches", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { holidays: [{ date: "2026-03-01", name: "Ramadan start" }] },
      }),
    });

    const first = await getHolidaysForYear(2026);
    const second = await getHolidaysForYear(2026);

    expect(first).toEqual(second);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("reads sanitized data from AsyncStorage cache before backend", async () => {
    await AsyncStorage.setItem(
      "holidays-2027",
      JSON.stringify([
        { date: "2027-03-01", name: " Ramadan 1st " },
        { date: "nope", name: "bad" },
      ]),
    );

    const holidays = await getHolidaysForYear(2027);
    const map = await getHolidayMapForYear(2027);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(holidays).toEqual([{ date: "2027-03-01", name: "Ramadan 1st" }]);
    expect(map).toEqual({ "2027-03-01": "Ramadan 1st" });
  });
});
