import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";

describe("Mosque Routes Integration", () => {
  const originalEnv = process.env;
  const mockGetNearbyMosques: jest.Mock = jest.fn();
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockGetNearbyMosques.mockReset();
    process.env = {
      ...originalEnv,
      GOOGLE_MAPS_API_KEY: "test-google-api-key",
    };

    jest.unstable_mockModule("../src/services/googleMapsService.js", () => ({
      getNearbyMosques: mockGetNearbyMosques,
    }));

    const mosqueRoutes = (await import("../src/routes/mosque.js")).default;
    app = express();
    app.use(express.json());
    app.use("/api/mosque", mosqueRoutes);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 400 when latitude is missing", async () => {
    const res = await request(app)
      .get("/api/mosque/nearby")
      .query({ longitude: -74.006 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("latitude");
  });

  it("returns 400 for invalid coordinates", async () => {
    const res = await request(app)
      .get("/api/mosque/nearby")
      .query({ latitude: 999, longitude: -74.006 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid latitude or longitude");
  });

  it("returns 400 for invalid radius", async () => {
    const res = await request(app)
      .get("/api/mosque/nearby")
      .query({ latitude: 40.7128, longitude: -74.006, radius: "not-a-number" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("radius");
  });

  it("returns 400 for malformed coordinates", async () => {
    const res = await request(app)
      .get("/api/mosque/nearby")
      .query({ latitude: "40.7128abc", longitude: -74.006 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid latitude or longitude");
  });

  it("clamps radius into safe bounds before calling upstream service", async () => {
    (mockGetNearbyMosques as any).mockResolvedValue([]);

    await request(app)
      .get("/api/mosque/nearby")
      .query({ latitude: 40.7128, longitude: -74.006, radius: 999999999 });

    expect(mockGetNearbyMosques).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
      radius: 5000,
    });
  });

  it("returns 200 with nearby mosques for valid request", async () => {
    (mockGetNearbyMosques as any).mockResolvedValue([
      {
        id: "p1",
        name: "Masjid Ar-Rahman",
        address: "456 Peace Ave",
        lat: 40.71,
        lng: -74,
      },
    ]);

    const res = await request(app)
      .get("/api/mosque/nearby")
      .query({ latitude: 40.7128, longitude: -74.006 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data).toEqual([
      {
        id: "p1",
        name: "Masjid Ar-Rahman",
        address: "456 Peace Ave",
        lat: 40.71,
        lng: -74,
      },
    ]);
  });

  it("returns mosque health response", async () => {
    const res = await request(app).get("/api/mosque/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("mosque");
    expect(typeof res.body.timestamp).toBe("string");
  });
});
