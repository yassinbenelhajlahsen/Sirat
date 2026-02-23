import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";

describe("Prayer Times Routes Integration", () => {
  const mockGetTimings: jest.Mock = jest.fn();
  const mockGetCalendar: jest.Mock = jest.fn();
  let app: Express;

  class MockAladhanServiceError extends Error {
    status: number;
    code: string;
    retriable: boolean;

    constructor(message: string, code: string, status: number, retriable: boolean) {
      super(message);
      this.status = status;
      this.code = code;
      this.retriable = retriable;
    }
  }

  beforeEach(async () => {
    jest.resetModules();
    mockGetTimings.mockReset();
    mockGetCalendar.mockReset();

    jest.unstable_mockModule("../src/services/aladhanService.js", () => ({
      AladhanServiceError: MockAladhanServiceError,
      getTimings: mockGetTimings,
      getCalendar: mockGetCalendar,
    }));

    const prayerTimesRoutes = (await import("../src/routes/prayerTimes.js")).default;
    app = express();
    app.use(express.json());
    app.use("/api/prayer-times", prayerTimesRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when required timings params are missing", async () => {
    const res = await request(app)
      .get("/api/prayer-times/timings")
      .query({ longitude: -74.006, method: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("latitude");
  });

  it("returns 400 for unsupported method", async () => {
    const res = await request(app)
      .get("/api/prayer-times/timings")
      .query({ latitude: 40.7128, longitude: -74.006, method: 999 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("method");
  });

  it("returns 200 with timings data for valid request", async () => {
    (mockGetTimings as any).mockResolvedValue({
      data: {
        timings: {
          Fajr: "05:12",
          Sunrise: "06:34",
          Dhuhr: "12:20",
          Asr: "15:40",
          Maghrib: "18:02",
          Isha: "19:18",
        },
      },
      stale: false,
      cacheStatus: "miss",
    });

    const res = await request(app)
      .get("/api/prayer-times/timings")
      .query({ latitude: 40.7128, longitude: -74.006, method: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stale).toBe(false);
    expect(res.body.cache).toBe("miss");
    expect(res.body.data.timings.Fajr).toBe("05:12");
    expect(mockGetTimings).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
      method: 2,
    });
    expect(res.body.resolvedMethod).toBe(2);
    expect(res.body.resolutionSource).toBe("explicit");
  });

  it("resolves method=auto from country for timings requests", async () => {
    (mockGetTimings as any).mockResolvedValue({
      data: {
        timings: {
          Fajr: "05:12",
          Sunrise: "06:34",
          Dhuhr: "12:20",
          Asr: "15:40",
          Maghrib: "18:02",
          Isha: "19:18",
        },
      },
      stale: false,
      cacheStatus: "miss",
    });

    const res = await request(app)
      .get("/api/prayer-times/timings")
      .query({
        latitude: 40.7128,
        longitude: -74.006,
        method: "auto",
        country: "United States",
      });

    expect(res.status).toBe(200);
    expect(res.body.resolvedMethod).toBe(2);
    expect(res.body.resolutionSource).toBe("auto-country");
    expect(mockGetTimings).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
      method: 2,
    });
  });

  it("supports legacy method=-1 and falls back when country is missing", async () => {
    (mockGetTimings as any).mockResolvedValue({
      data: {
        timings: {
          Fajr: "05:12",
          Sunrise: "06:34",
          Dhuhr: "12:20",
          Asr: "15:40",
          Maghrib: "18:02",
          Isha: "19:18",
        },
      },
      stale: false,
      cacheStatus: "miss",
    });

    const res = await request(app)
      .get("/api/prayer-times/timings")
      .query({
        latitude: 40.7128,
        longitude: -74.006,
        method: -1,
      });

    expect(res.status).toBe(200);
    expect(res.body.resolvedMethod).toBe(3);
    expect(res.body.resolutionSource).toBe("auto-fallback");
    expect(mockGetTimings).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
      method: 3,
    });
  });

  it("maps service errors into structured API errors", async () => {
    (mockGetTimings as any).mockRejectedValue(
      new MockAladhanServiceError(
        "Aladhan rate limit reached.",
        "RATE_LIMIT",
        429,
        true,
      ),
    );

    const res = await request(app)
      .get("/api/prayer-times/timings")
      .query({ latitude: 40.7128, longitude: -74.006, method: 2 });

    expect(res.status).toBe(429);
    expect(res.body.error).toEqual({
      code: "RATE_LIMIT",
      message: "Aladhan rate limit reached.",
      retriable: true,
    });
    expect(res.body.stale).toBe(false);
  });

  it("returns 400 for invalid calendar month", async () => {
    const res = await request(app).get("/api/prayer-times/calendar").query({
      latitude: 40.7128,
      longitude: -74.006,
      method: 2,
      month: 13,
      year: 2026,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("month");
  });

  it("returns 200 with calendar data for valid request", async () => {
    (mockGetCalendar as any).mockResolvedValue({
      data: [
        {
          date: { gregorian: { date: "01-02-2026" } },
          timings: {
            Fajr: "05:12",
            Sunrise: "06:34",
            Dhuhr: "12:20",
            Asr: "15:40",
            Maghrib: "18:02",
            Isha: "19:18",
          },
        },
      ],
      stale: false,
      cacheStatus: "hit",
    });

    const res = await request(app).get("/api/prayer-times/calendar").query({
      latitude: 40.7128,
      longitude: -74.006,
      method: 2,
      month: 2,
      year: 2026,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cache).toBe("hit");
    expect(res.body.data).toHaveLength(1);
    expect(mockGetCalendar).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
      method: 2,
      month: 2,
      year: 2026,
    });
    expect(res.body.resolvedMethod).toBe(2);
    expect(res.body.resolutionSource).toBe("explicit");
  });

  it("resolves method=auto for calendar requests", async () => {
    (mockGetCalendar as any).mockResolvedValue({
      data: [
        {
          date: { gregorian: { date: "01-02-2026" } },
          timings: {
            Fajr: "05:12",
            Sunrise: "06:34",
            Dhuhr: "12:20",
            Asr: "15:40",
            Maghrib: "18:02",
            Isha: "19:18",
          },
        },
      ],
      stale: false,
      cacheStatus: "hit",
    });

    const res = await request(app).get("/api/prayer-times/calendar").query({
      latitude: 41.0082,
      longitude: 28.9784,
      method: "auto",
      country: "Turkey",
      month: 2,
      year: 2026,
    });

    expect(res.status).toBe(200);
    expect(res.body.resolvedMethod).toBe(13);
    expect(res.body.resolutionSource).toBe("auto-country");
    expect(mockGetCalendar).toHaveBeenCalledWith({
      latitude: 41.0082,
      longitude: 28.9784,
      method: 13,
      month: 2,
      year: 2026,
    });
  });

  it("returns 400 for invalid non-numeric/non-auto method", async () => {
    const res = await request(app).get("/api/prayer-times/calendar").query({
      latitude: 40.7128,
      longitude: -74.006,
      method: "auto-ish",
      month: 2,
      year: 2026,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("integer or 'auto'");
  });

  it("returns prayer-times health response", async () => {
    const res = await request(app).get("/api/prayer-times/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("prayer-times");
    expect(typeof res.body.timestamp).toBe("string");
  });
});
