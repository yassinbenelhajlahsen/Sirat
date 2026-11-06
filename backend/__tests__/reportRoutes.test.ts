import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const mockGetAuth: jest.Mock<any> = jest.fn();
const mockCreate: jest.Mock<any> = jest.fn();

describe("Report Routes Integration", () => {
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockGetAuth.mockReset();
    mockCreate.mockReset();
    mockGetAuth.mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    mockCreate.mockImplementation(async (input: any) => ({ id: "rep_1", ...input }));

    jest.unstable_mockModule("@clerk/express", () => ({
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      getAuth: mockGetAuth,
      clerkClient: { users: { deleteUser: jest.fn() } },
    }));
    jest.unstable_mockModule("../src/services/reportService.js", () => ({
      createContentReport: mockCreate,
    }));

    const reportRoutes = (await import("../src/routes/report.js")).default;
    app = express();
    app.use(express.json());
    app.use("/api/reports", reportRoutes);
    app.use(errorHandler);
  });

  afterEach(() => { jest.clearAllMocks(); });

  const post = (body: unknown) =>
    request(app).post("/api/reports").set("x-sirat-app-version", "1.4.0").send(body as object);

  it("saves a dua report with only the known output fields", async () => {
    const res = await post({ kind: "dua", input: "  help with exams  ", output: { duaId: 42, extra: "x" } }).expect(201);

    expect(res.body).toEqual({ id: "rep_1" });
    expect(mockCreate).toHaveBeenCalledWith({
      kind: "dua",
      input: "help with exams",
      output: { duaId: 42 },
      userId: "user_abc",
      appVersion: "1.4.0",
    });
  });

  it("signed out saves with userId null", async () => {
    mockGetAuth.mockReturnValue({ isAuthenticated: false, userId: null });
    await post({ kind: "dua", input: "exams", output: { duaId: 1 } }).expect(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it.each([
    ["unknown kind", { kind: "nope", input: "hi", output: { duaId: 1 } }],
    ["prototype key as kind", { kind: "constructor", input: "hi", output: { duaId: 1 } }],
    ["missing input", { kind: "dua", output: { duaId: 1 } }],
    ["whitespace input", { kind: "dua", input: "  ", output: { duaId: 1 } }],
    ["2,001-char input", { kind: "dua", input: "a".repeat(2001), output: { duaId: 1 } }],
    ["missing output", { kind: "dua", input: "hi" }],
    ["string duaId", { kind: "dua", input: "hi", output: { duaId: "1" } }],
    ["zero duaId", { kind: "dua", input: "hi", output: { duaId: 0 } }],
    ["fractional duaId", { kind: "dua", input: "hi", output: { duaId: 1.5 } }],
  ])("rejects %s with 400", async (_name, body) => {
    await post(body).expect(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("saves a chat report with only the answer and citation ids", async () => {
    const output = { answer: "  Interest is not permitted.\n", citationIds: ["q:2:275", "h:2962", "d:12"], citations: [{ text: "x" }], extra: 1 };

    await post({ kind: "chat", input: " Is interest allowed? ", output }).expect(201);

    expect(mockCreate).toHaveBeenCalledWith({
      kind: "chat",
      input: "Is interest allowed?",
      output: { answer: "  Interest is not permitted.\n", citationIds: ["q:2:275", "h:2962", "d:12"] },
      userId: "user_abc",
      appVersion: "1.4.0",
    });
  });

  it("accepts a chat answer with no citations", async () => {
    await post({ kind: "chat", input: "hi", output: { answer: "a", citationIds: [] } }).expect(201);
  });

  it.each([
    ["a 4,001-char answer", { answer: "a".repeat(4001), citationIds: [] }],
    ["an empty answer", { answer: "", citationIds: [] }],
    ["a non-string answer", { answer: 5, citationIds: [] }],
    ["a malformed citation id", { answer: "a", citationIds: ["x:1"] }],
    ["a four-digit surah", { answer: "a", citationIds: ["q:1000:1"] }],
    ["7 citation ids", { answer: "a", citationIds: ["h:1", "h:2", "h:3", "h:4", "h:5", "h:6", "h:7"] }],
    ["a dua id with no number", { answer: "a", citationIds: ["d:"] }],
    ["a dua id with letters", { answer: "a", citationIds: ["d:12x"] }],
    ["a non-array citationIds", { answer: "a", citationIds: "q:2:275" }],
    ["a non-string citation id", { answer: "a", citationIds: [275] }],
  ])("rejects a chat report with %s", async (_name, output) => {
    await post({ kind: "chat", input: "hi", output }).expect(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 500 without logging what the user typed when saving fails", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(Object.assign(new Error("Invalid create() with input SECRET-TEXT"), { code: "P2000" }));
    await post({ kind: "dua", input: "SECRET-TEXT", output: { duaId: 1 } }).expect(500);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("SECRET-TEXT");
    spy.mockRestore();
  });
});
