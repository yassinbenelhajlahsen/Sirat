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

  describe("POST /api/dua", () => {
    it("should return 400 for missing userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({})
        .expect("Content-Type", /json/)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("userRequest is required");
    });

    it("should return 400 for empty userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "" })
        .expect("Content-Type", /json/)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 for short userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "ab" })
        .expect("Content-Type", /json/)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("at least 3 characters");
    });

    it("should handle valid request (uses actual duas.json)", async () => {
      const response = await request(app)
        .post("/api/dua")
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
        .post("/api/dua")
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
        .post("/api/dua")
        .send({ userRequest: null })
        .expect(400);

      expect(response.body.error).toContain("userRequest is required");
    });

    it("should return 400 for undefined userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: undefined })
        .expect(400);

      expect(response.body.error).toContain("userRequest is required");
    });

    it("should return 400 for number userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: 123 })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should return 400 for boolean userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: true })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should return 400 for array userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: ["help"] })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should return 400 for object userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: { text: "help" } })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should trim whitespace from userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "   help me with anxiety   " })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
    });

    it("should return 400 for whitespace-only userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "   " })
        .expect(400);

      expect(response.body.error).toContain("at least 3 characters");
    });

    it("should handle unicode characters in userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "أحتاج مساعدة" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
    });

    it("should handle special characters in userRequest", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "I'm feeling anxious!" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
    });

    it("should handle very long userRequest", async () => {
      const longRequest =
        "I need help with anxiety about my upcoming exam and I'm also worried about my health and family";
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: longRequest })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
    });
  });

  describe("AI/Fallback Matching", () => {
    it("should use AI or fallback for vague queries", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "help me with something" })
        .expect(200);

      expect(response.body).toHaveProperty("dua");
      expect(response.body).toHaveProperty("matchSource");
      expect(["ai", "fallback"]).toContain(response.body.matchSource);
    });

    it("should still return valid dua for broad queries", async () => {
      const response = await request(app)
        .post("/api/dua")
        .send({ userRequest: "random text" })
        .expect(200);

      expect(response.body.dua).toBeDefined();
      expect(response.body.dua.id).toBeGreaterThan(0);
      expect(response.body.dua.category).toBeTruthy();
    });

    it("should return valid dua structure", async () => {
      const response = await request(app)
        .post("/api/dua")
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
    });
  });
});
