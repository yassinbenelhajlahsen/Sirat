import { fetchPrayerProxy } from "@/services/prayer-times/apiClient";

describe("prayer-times/apiClient", () => {
  const fetchMock = global.fetch as jest.Mock;

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("builds query string and returns data on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { timings: { Fajr: "05:00" } } }),
    });

    const result = await fetchPrayerProxy<{ timings: { Fajr: string } }>(
      "/api/prayer-times/timings",
      { latitude: 41.88, longitude: -87.63, method: "auto", country: "US" },
    );

    expect(result).toEqual({ timings: { Fajr: "05:00" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/prayer-times/timings?");
    expect(fetchMock.mock.calls[0][0]).toContain("latitude=41.88");
    expect(fetchMock.mock.calls[0][0]).toContain("longitude=-87.63");
    expect(fetchMock.mock.calls[0][0]).toContain("method=auto");
    expect(fetchMock.mock.calls[0][0]).toContain("country=US");
  });

  it("maps backend string error on non-200", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad request payload" }),
    });

    await expect(
      fetchPrayerProxy("/api/prayer-times/timings", { latitude: 1, longitude: 2, method: 2 }),
    ).rejects.toThrow("Bad request payload");
  });

  it("maps backend object error message on non-200", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Too many requests" } }),
    });

    await expect(
      fetchPrayerProxy("/api/prayer-times/timings", { latitude: 1, longitude: 2, method: 2 }),
    ).rejects.toThrow("Too many requests");
  });

  it("falls back to generic error message when body is unusable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    await expect(
      fetchPrayerProxy("/api/prayer-times/timings", { latitude: 1, longitude: 2, method: 2 }),
    ).rejects.toThrow("Prayer times API error (503)");
  });

  it("throws when success envelope is invalid", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    });

    await expect(
      fetchPrayerProxy("/api/prayer-times/calendar/year", { latitude: 1, longitude: 2, method: 2, year: 2026 }),
    ).rejects.toThrow("Invalid response from prayer times API");
  });
});
