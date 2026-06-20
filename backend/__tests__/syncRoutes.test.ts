import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const mockGetAuth: jest.Mock = jest.fn();
const mockSyncDomains: jest.Mock = jest.fn();

describe("Sync Routes Integration", () => {
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockGetAuth.mockReset();
    mockSyncDomains.mockReset();
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    (mockSyncDomains as any).mockResolvedValue({
      prayer_log: {}, habits: [], habit_log: {}, settings: {},
      syncedAt: "2026-06-20T00:00:00.000Z",
    });

    jest.unstable_mockModule("@clerk/express", () => ({
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      getAuth: mockGetAuth,
      clerkClient: { users: { deleteUser: jest.fn() } },
    }));
    jest.unstable_mockModule("../src/services/syncService.js", () => ({
      syncDomains: mockSyncDomains,
    }));

    const syncRoutes = (await import("../src/routes/sync.js")).default;
    app = express();
    app.use("/api/sync", syncRoutes);
    app.use(errorHandler);
  });

  afterEach(() => { jest.clearAllMocks(); });

  it("returns merged docs for an authenticated request", async () => {
    const res = await request(app)
      .post("/api/sync")
      .send({ prayer_log: { "2026-06-19": { fajr: { value: "prayed", updatedAt: 9 } } } })
      .expect("Content-Type", /json/)
      .expect(200);

    expect(res.body).toMatchObject({
      prayer_log: {}, habits: [], habit_log: {}, settings: {},
      syncedAt: expect.any(String),
    });
    expect(mockSyncDomains).toHaveBeenCalledTimes(1);
    expect(mockSyncDomains).toHaveBeenCalledWith("user_abc", {
      prayer_log: { "2026-06-19": { fajr: { value: "prayed", updatedAt: 9 } } },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: false, userId: null });

    const res = await request(app).post("/api/sync").send({}).expect(401);

    expect(res.body).toEqual({ error: "Authentication required" });
    expect(mockSyncDomains).not.toHaveBeenCalled();
  });

  it("returns 400 when habits is not an array", async () => {
    const res = await request(app).post("/api/sync").send({ habits: {} }).expect(400);

    expect(res.body.error).toContain("habits must be an array");
    expect(mockSyncDomains).not.toHaveBeenCalled();
  });

  it("returns 500 when the sync service throws", async () => {
    (mockSyncDomains as any).mockRejectedValue(new Error("db down"));

    const res = await request(app).post("/api/sync").send({}).expect(500);

    expect(res.body).toEqual({ error: "Sync failed" });
  });
});
