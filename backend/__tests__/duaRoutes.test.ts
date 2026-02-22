import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

describe("Dua Routes Integration", () => {
  const mockSelectDuaWithOpenAI: jest.Mock = jest.fn();
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockSelectDuaWithOpenAI.mockReset();
    (mockSelectDuaWithOpenAI as any).mockResolvedValue({ duaId: 1 });

    jest.unstable_mockModule("../src/services/openaiService.js", () => ({
      selectDuaWithOpenAI: mockSelectDuaWithOpenAI,
    }));

    const duaRoutes = (await import("../src/routes/dua.js")).default;
    app = express();
    app.use(express.json());
    app.use("/api/dua", duaRoutes);
    app.use(errorHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/dua", () => {
    it.each([
      [{}, "userRequest is required"],
      [{ userRequest: "" }, "userRequest is required"],
      [{ userRequest: "  " }, "at least 3 characters"],
      [{ userRequest: "ab" }, "at least 3 characters"],
      [{ userRequest: null }, "userRequest is required"],
      [{ userRequest: 123 }, "must be a string"],
      [{ userRequest: true }, "must be a string"],
      [{ userRequest: ["help"] }, "must be a string"],
      [{ userRequest: { text: "help" } }, "must be a string"],
    ])(
      "returns 400 for invalid payload: %j",
      async (payload, expectedMessage) => {
        const response = await request(app).post("/api/dua").send(payload).expect(400);

        expect(response.body.error).toContain(expectedMessage);
      },
    );

    it("returns a valid dua payload for a valid request", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "I need healing from illness" })
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body).toHaveProperty("matchSource", "ai");
      expect(response.body.dua).toMatchObject({
        id: expect.any(Number),
        category: expect.any(String),
        tags: expect.any(Array),
        arabic: expect.any(String),
        english: expect.any(String),
        transliteration: expect.any(String),
        reference: expect.any(String),
        source: expect.any(String),
      });
      expect(response.body).not.toHaveProperty("reasoning");
      expect(response.body).not.toHaveProperty("matchScore");
      expect(mockSelectDuaWithOpenAI).toHaveBeenCalledTimes(1);
    });

    it("still accepts valid requests with surrounding whitespace", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "   help me with anxiety   " })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body).toHaveProperty("matchSource");
    });

    it("falls back when OpenAI service throws", async () => {
      (mockSelectDuaWithOpenAI as any).mockRejectedValue(
        new Error("Failed to select dua with OpenAI"),
      );

      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "help me with worry" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body.matchSource).toBe("fallback");
      expect(mockSelectDuaWithOpenAI).toHaveBeenCalledTimes(1);
    });

    it("falls back when OpenAI returns an unknown duaId", async () => {
      (mockSelectDuaWithOpenAI as any).mockResolvedValue({ duaId: 999999 });

      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "give me any dua" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body.matchSource).toBe("fallback");
      expect(mockSelectDuaWithOpenAI).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/dua/health", () => {
    it("returns health metadata", async () => {
      const response = await request(app)
        .get("/api/dua/health")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toMatchObject({
        status: "ok",
        duasCount: expect.any(Number),
        timestamp: expect.any(String),
      });
      expect(response.body.duasCount).toBeGreaterThan(0);
      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
