import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import duaRoutes from "../src/routes/dua.js";
import * as openaiService from "../src/services/openaiService.js";

describe("Dua Routes Integration", () => {
  let app: Express;
  let selectDuaWithOpenAISpy: jest.SpiedFunction<
    typeof openaiService.selectDuaWithOpenAI
  >;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/dua", duaRoutes);
    app.use(errorHandler);
  });

  beforeEach(() => {
    // Spy on the OpenAI service function
    selectDuaWithOpenAISpy = jest.spyOn(openaiService, "selectDuaWithOpenAI");

    // Default mock implementation: return dua ID 1 for most tests
    selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 1 });
  });

  afterEach(() => {
    // Restore the original implementation after each test
    jest.restoreAllMocks();
  });

  describe("POST /api/dua/match", () => {
    it("should return 400 for missing userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({})
        .expect("Content-Type", /json/)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("userRequest is required");
    });

    it("should return 400 for empty userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "" })
        .expect("Content-Type", /json/)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 for short userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "ab" })
        .expect("Content-Type", /json/)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("at least 3 characters");
    });

    it("should handle valid request (uses actual duas.json)", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I need healing from illness" })
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body.dua).toHaveProperty("id");
      expect(response.body.dua).toHaveProperty("category");
      expect(response.body.dua).toHaveProperty("arabic");
      expect(response.body.dua).toHaveProperty("english");
    });

    it("should return dua without extra fields", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "help with anxiety" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body).not.toHaveProperty("reasoning");
      expect(response.body).not.toHaveProperty("matchScore");
      expect(response.body).not.toHaveProperty("confidence");
    });
  });

  describe("GET /api/dua/health", () => {
    it("should return health status", async () => {
      const response = await request(app)
        .get("/api/dua/health")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toHaveProperty("status");
      expect(response.body.status).toBe("ok");
    });

    it("should return duas count", async () => {
      const response = await request(app).get("/api/dua/health").expect(200);

      expect(response.body).toHaveProperty("duasCount");
      expect(typeof response.body.duasCount).toBe("number");
      expect(response.body.duasCount).toBeGreaterThan(0);
    });

    it("should return timestamp", async () => {
      const response = await request(app).get("/api/dua/health").expect(200);

      expect(response.body).toHaveProperty("timestamp");
      expect(typeof response.body.timestamp).toBe("string");
      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe("Edge Cases & Error Scenarios", () => {
    it("should return 400 for null userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: null })
        .expect(400);

      expect(response.body.error).toContain("userRequest is required");
    });

    it("should return 400 for undefined userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: undefined })
        .expect(400);

      expect(response.body.error).toContain("userRequest is required");
    });

    it("should return 400 for number userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: 123 })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should return 400 for boolean userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: true })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should return 400 for array userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: ["help"] })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should return 400 for object userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: { text: "help" } })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should trim whitespace from userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "   help me with anxiety   " })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
    });

    it("should return 400 for whitespace-only userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "   " })
        .expect(400);

      expect(response.body.error).toContain("at least 3 characters");
    });

    it("should handle unicode characters in userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "أحتاج مساعدة" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
    });

    it("should handle special characters in userRequest", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I'm feeling anxious!" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
    });

    it("should handle very long userRequest", async () => {
      const longRequest =
        "I need help with anxiety about my upcoming exam and I'm also worried about my health and family";
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: longRequest })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
    });
  });

  describe("OpenAI Integration Tests (Mocked)", () => {
    describe("POST /api/dua/match with OpenAI", () => {
      it("should use OpenAI to intelligently match healing request", async () => {
        // Mock OpenAI to return a specific dua ID
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 1 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "I am sick and need prayers for healing" })
          .expect(200);

        expect(response.body).toHaveProperty("dua");
        expect(response.body.dua).toHaveProperty("id");
        expect(response.body.dua).toHaveProperty("category");
        expect(response.body.dua).toHaveProperty("arabic");

        // Should return a valid dua (OpenAI made the selection)
        expect(response.body.dua.id).toBeGreaterThan(0);
        expect(response.body.dua.category).toBeTruthy();

        // Verify OpenAI was called
        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should use OpenAI to match anxiety request", async () => {
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 2 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "I'm very anxious about my exam tomorrow" })
          .expect(200);

        expect(response.body.dua).toBeDefined();
        expect(response.body.dua.id).toBeGreaterThan(0);
        expect(response.body.dua.category).toBeTruthy();
        expect(response.body.dua.tags).toBeDefined();
        expect(Array.isArray(response.body.dua.tags)).toBe(true);

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should use OpenAI to match gratitude request", async () => {
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 3 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "I want to thank Allah for all my blessings" })
          .expect(200);

        expect(response.body.dua).toBeDefined();
        expect(response.body.dua.id).toBeGreaterThan(0);
        expect(response.body.dua.category).toBeTruthy();

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should handle complex request with OpenAI", async () => {
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 5 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({
            userRequest:
              "I'm stressed about work, feeling overwhelmed and anxious",
          })
          .expect(200);

        expect(response.body.dua).toBeDefined();
        expect(response.body.dua.id).toBeGreaterThan(0);
        expect(response.body.dua.tags).toBeDefined();
        expect(Array.isArray(response.body.dua.tags)).toBe(true);

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should handle Arabic request with OpenAI", async () => {
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 1 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "أنا مريض وأحتاج إلى الشفاء" })
          .expect(200);

        expect(response.body.dua).toBeDefined();
        expect(response.body.dua.id).toBeGreaterThan(0);
        expect(response.body.dua.category).toBeTruthy();
        // Arabic text means "I am sick and need healing" - OpenAI should understand it
        expect(response.body.dua.arabic).toBeTruthy();

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should not include reasoning or extra fields", async () => {
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 1 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "help me" })
          .expect(200);

        expect(response.body).toHaveProperty("dua");
        expect(response.body).not.toHaveProperty("reasoning");
        expect(response.body).not.toHaveProperty("confidence");
        expect(response.body).not.toHaveProperty("matchScore");
        expect(response.body.dua).not.toHaveProperty("reasoning");

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should handle rapid requests consistently", async () => {
        // Mock different dua IDs for each request
        selectDuaWithOpenAISpy
          .mockResolvedValueOnce({ duaId: 1 })
          .mockResolvedValueOnce({ duaId: 2 })
          .mockResolvedValueOnce({ duaId: 3 });

        const requests = ["I'm sick", "I'm anxious", "I'm grateful"];

        const responses = await Promise.all(
          requests.map((req) =>
            request(app).post("/api/dua/match").send({ userRequest: req }),
          ),
        );

        responses.forEach((res) => {
          expect(res.status).toBe(200);
          expect(res.body.dua).toBeDefined();
        });

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(3);
      });

      it("should handle edge case short request", async () => {
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 1 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "sad" })
          .expect(200);

        expect(response.body.dua).toBeDefined();

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should handle request with special characters", async () => {
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 1 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "I'm feeling... really stressed!!! Help???" })
          .expect(200);

        expect(response.body.dua).toBeDefined();

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should return valid dua structure from OpenAI response", async () => {
        selectDuaWithOpenAISpy.mockResolvedValue({ duaId: 1 });

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "I need guidance" })
          .expect(200);

        const dua = response.body.dua;
        expect(dua).toHaveProperty("id");
        expect(dua).toHaveProperty("category");
        expect(dua).toHaveProperty("tags");
        expect(dua).toHaveProperty("arabic");
        expect(dua).toHaveProperty("english");
        expect(dua).toHaveProperty("transliteration");
        expect(dua).toHaveProperty("reference");
        expect(dua).toHaveProperty("source");

        expect(Array.isArray(dua.tags)).toBe(true);
        expect(typeof dua.arabic).toBe("string");
        expect(typeof dua.english).toBe("string");

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });
    });

    describe("OpenAI Fallback Behavior", () => {
      it("should use fallback when OpenAI fails", async () => {
        // Mock OpenAI to throw an error
        selectDuaWithOpenAISpy.mockRejectedValue(
          new Error("Failed to select dua with OpenAI"),
        );

        const response = await request(app)
          .post("/api/dua/match")
          .send({ userRequest: "help me" })
          .expect(200);

        // Should still return a dua (via fallback)
        expect(response.body).toHaveProperty("dua");
        expect(response.body.dua.id).toBeGreaterThan(0);

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(1);
      });

      it("should handle multiple sequential requests", async () => {
        selectDuaWithOpenAISpy
          .mockResolvedValueOnce({ duaId: 1 })
          .mockResolvedValueOnce({ duaId: 2 })
          .mockResolvedValueOnce({ duaId: 3 });

        const requests = ["I'm sick", "I'm worried", "I'm thankful"];

        for (const req of requests) {
          const response = await request(app)
            .post("/api/dua/match")
            .send({ userRequest: req });

          expect(response.status).toBe(200);
          expect(response.body.dua).toBeDefined();
        }

        expect(selectDuaWithOpenAISpy).toHaveBeenCalledTimes(3);
      });
    });
  });
});
