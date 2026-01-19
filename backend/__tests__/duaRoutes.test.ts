import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import duaRoutes from "../src/routes/dua.js";

describe("Dua Routes Integration", () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use("/api/dua", duaRoutes);
    app.use(errorHandler);
  });

  afterEach(() => {
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

  describe("Regex-First Matching Tests", () => {
    it("should match anxiety queries using regex (no AI call)", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I'm feeling anxious" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body).toHaveProperty("matchSource");
      expect(response.body.matchSource).toBe("regex");
      expect(response.body.dua.category).toBe("anxiety");
    });

    it("should match sleep queries using regex", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I can't sleep at night" })
        .expect(200);

      expect(response.body.matchSource).toBe("regex");
      expect(response.body.dua.category).toBe("sleep");
    });

    it("should match exam/knowledge queries using regex", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I have an exam tomorrow" })
        .expect(200);

      expect(response.body.matchSource).toBe("regex");
      expect(response.body.dua.category).toBe("exam");
    });

    it("should match healing queries using regex", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I am sick and need healing" })
        .expect(200);

      expect(response.body.matchSource).toBe("regex");
      expect(response.body.dua.category).toBe("healing");
    });

    it("should match forgiveness queries using regex", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "Please forgive me for my sins" })
        .expect(200);

      expect(response.body.matchSource).toBe("regex");
      expect(response.body.dua.category).toBe("forgiveness");
    });

    it("should match gratitude queries using regex", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I want to thank Allah for my blessings" })
        .expect(200);

      expect(response.body.matchSource).toBe("regex");
      expect(response.body.dua.category).toBe("gratitude");
    });

    it("should return valid dua structure", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I'm stressed out" })
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
    });

    it("should not include reasoning or extra fields", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "I'm worried" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body).toHaveProperty("matchSource");
      expect(response.body).not.toHaveProperty("reasoning");
      expect(response.body).not.toHaveProperty("confidence");
      expect(response.body).not.toHaveProperty("matchScore");
      expect(response.body.dua).not.toHaveProperty("reasoning");
    });

    it("should handle multiple rapid regex matches consistently", async () => {
      const requests = [
        { text: "I'm sick", category: "healing" },
        { text: "I'm anxious", category: "anxiety" },
        { text: "I'm grateful", category: "gratitude" },
      ];

      const responses = await Promise.all(
        requests.map((req) =>
          request(app).post("/api/dua/match").send({ userRequest: req.text }),
        ),
      );

      responses.forEach((res, index) => {
        expect(res.status).toBe(200);
        expect(res.body.dua).toBeDefined();
        expect(res.body.matchSource).toBe("regex");
        expect(res.body.dua.category).toBe(requests[index].category);
      });
    });
  });

  describe("AI Fallback for Non-Matching Queries", () => {
    it("should use AI or fallback for vague queries that don't match regex", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "help me with something" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body).toHaveProperty("matchSource");
      // Should use AI or fallback, not regex
      expect(["ai", "fallback"]).toContain(response.body.matchSource);
    });

    it("should still return valid dua even when regex doesn't match", async () => {
      const response = await request(app)
        .post("/api/dua/match")
        .send({ userRequest: "random text" })
        .expect(200);

      expect(response.body.dua).toBeDefined();
      expect(response.body.dua.id).toBeGreaterThan(0);
      expect(response.body.dua.category).toBeTruthy();
    });
  });
});
