import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";

describe("Holiday Routes Integration", () => {
  const mockGetHolidays: jest.Mock = jest.fn();
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
    mockGetHolidays.mockReset();

    jest.unstable_mockModule("../src/services/aladhanService.js", () => ({
      AladhanServiceError: MockAladhanServiceError,
      getHolidays: mockGetHolidays,
    }));

    const holidayRoutes = (await import("../src/routes/holiday.js")).default;
    app = express();
    app.use(express.json());
    app.use("/api/holidays", holidayRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when year query is missing", async () => {
    const res = await request(app).get("/api/holidays/year");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("year");
  });

  it("returns 400 for year outside accepted range", async () => {
    const res = await request(app).get("/api/holidays/year").query({ year: 2200 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("year");
  });

  it("returns 200 with holidays payload for valid request", async () => {
    (mockGetHolidays as any).mockResolvedValue({
      data: {
        holidays: [{ date: "2026-03-01", name: "Ramadan Begins" }],
      },
      stale: false,
      cacheStatus: "miss",
    });

    const res = await request(app).get("/api/holidays/year").query({ year: 2026 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stale).toBe(false);
    expect(res.body.cache).toBe("miss");
    expect(res.body.data.holidays).toEqual([
      { date: "2026-03-01", name: "Ramadan Begins" },
    ]);
    expect(mockGetHolidays).toHaveBeenCalledWith(2026);
  });

  it("maps service errors into structured API errors", async () => {
    (mockGetHolidays as any).mockRejectedValue(
      new MockAladhanServiceError(
        "Aladhan rate limit reached.",
        "RATE_LIMIT",
        429,
        true,
      ),
    );

    const res = await request(app).get("/api/holidays/year").query({ year: 2026 });

    expect(res.status).toBe(429);
    expect(res.body.error).toEqual({
      code: "RATE_LIMIT",
      message: "Aladhan rate limit reached.",
      retriable: true,
    });
    expect(res.body.stale).toBe(false);
  });

  it("returns holidays health response", async () => {
    const res = await request(app).get("/api/holidays/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("holidays");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("returns structured rate-limit response after exceeding request cap", async () => {
    (mockGetHolidays as any).mockResolvedValue({
      data: { holidays: [] },
      stale: false,
      cacheStatus: "hit",
    });

    for (let i = 0; i < 180; i++) {
      const okRes = await request(app).get("/api/holidays/year").query({ year: 2026 });
      expect(okRes.status).toBe(200);
    }

    const limitedRes = await request(app).get("/api/holidays/year").query({ year: 2026 });
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests from this IP, please try again later.",
        retriable: true,
      },
    });
  }, 20000);
});
