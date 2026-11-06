import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const mockGetAuth: jest.Mock<any> = jest.fn();
const mockCreate: jest.Mock<any> = jest.fn();
const mockSendEmail: jest.Mock<any> = jest.fn();

const diagnostics = {
  context: { os: "iOS", osVersion: "18.1", deviceModel: "iPhone15,2", updateId: null },
  entries: [{ at: 1, kind: "error", message: "boom" }],
};

describe("Feedback Routes Integration", () => {
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockGetAuth.mockReset();
    mockCreate.mockReset();
    mockSendEmail.mockReset();
    mockGetAuth.mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    mockCreate.mockImplementation(async (input: any) => ({ id: "rep_1", ...input }));
    mockSendEmail.mockResolvedValue(undefined);

    jest.unstable_mockModule("@clerk/express", () => ({
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      getAuth: mockGetAuth,
      clerkClient: { users: { deleteUser: jest.fn() } },
    }));
    jest.unstable_mockModule("../src/services/feedbackService.js", () => ({
      createFeedbackReport: mockCreate,
    }));
    jest.unstable_mockModule("../src/services/emailService.js", () => ({
      sendFeedbackEmail: mockSendEmail,
    }));

    const feedbackRoutes = (await import("../src/routes/feedback.js")).default;
    app = express();
    app.use("/api/feedback", feedbackRoutes);
    app.use(errorHandler);
  });

  afterEach(() => { jest.clearAllMocks(); });

  const post = (body: unknown) =>
    request(app)
      .post("/api/feedback")
      .set("x-sirat-app-version", "1.4.0")
      .set("x-sirat-platform", "ios")
      .send(body as object);

  it("saves feedback and returns 201 with id", async () => {
    const res = await post({ type: "feedback", message: "  Love it  ", email: "a@b.co" }).expect(201);

    expect(res.body).toEqual({ id: "rep_1" });
    expect(mockCreate).toHaveBeenCalledWith({
      type: "feedback",
      message: "Love it",
      email: "a@b.co",
      userId: "user_abc",
      appVersion: "1.4.0",
      platform: null,
      device: null,
      diagnostics: null,
    });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("bug stores device, platform and diagnostics", async () => {
    await post({ type: "bug", message: "Crash", diagnostics }).expect(201);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "bug",
        email: null,
        platform: "ios",
        device: "iPhone15,2 (iOS 18.1)",
        diagnostics,
      }),
    );
  });

  it("feedback ignores diagnostics in the body", async () => {
    await post({ type: "feedback", message: "Hi", diagnostics }).expect(201);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ diagnostics: null, device: null, platform: null }),
    );
  });

  it("signed out saves with userId null", async () => {
    mockGetAuth.mockReturnValue({ isAuthenticated: false, userId: null });
    await post({ type: "feedback", message: "Hi" }).expect(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("getAuth throwing still saves with userId null", async () => {
    mockGetAuth.mockImplementation(() => { throw new Error("bad token"); });
    await post({ type: "feedback", message: "Hi" }).expect(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("responds 201 when the email fails", async () => {
    mockSendEmail.mockRejectedValue(new Error("resend down"));
    const res = await post({ type: "feedback", message: "Hi" }).expect(201);
    expect(res.body).toEqual({ id: "rep_1" });
  });

  it("returns 500 when saving fails", async () => {
    mockCreate.mockRejectedValue(new Error("db down"));
    await post({ type: "feedback", message: "Hi" }).expect(500);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["bad type", { type: "praise", message: "Hi" }],
    ["missing message", { type: "feedback" }],
    ["whitespace message", { type: "feedback", message: "   " }],
    ["4,001-char message", { type: "feedback", message: "a".repeat(4001) }],
    ["malformed email", { type: "feedback", message: "Hi", email: "not-an-email" }],
    ["over-long email", { type: "feedback", message: "Hi", email: `${"a".repeat(250)}@b.co` }],
    ["non-object diagnostics", { type: "bug", message: "Hi", diagnostics: "logs" }],
    ["diagnostics over 200,000 chars", {
      type: "bug", message: "Hi",
      diagnostics: { context: diagnostics.context, entries: ["x".repeat(200_001)] },
    }],
  ])("rejects %s with 400", async (_name, body) => {
    await post(body).expect(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects deeply nested diagnostics with 400 instead of crashing", async () => {
    const depth = 100_000;
    const raw = `{"type":"bug","message":"x","diagnostics":{"a":${"[".repeat(depth)}${"]".repeat(depth)}}}`;
    await request(app)
      .post("/api/feedback")
      .set("Content-Type", "application/json")
      .send(raw)
      .expect(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("caps the device label length", async () => {
    const context = { ...diagnostics.context, deviceModel: "d".repeat(5000) };
    await post({ type: "bug", message: "Crash", diagnostics: { ...diagnostics, context } }).expect(201);
    expect((mockCreate.mock.calls[0][0] as any).device.length).toBeLessThanOrEqual(128);
  });

  it("does not log the report text when saving fails", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(Object.assign(new Error("Invalid create() with message SECRET-TEXT"), { code: "P2000" }));
    await post({ type: "feedback", message: "SECRET-TEXT" }).expect(500);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("SECRET-TEXT");
    spy.mockRestore();
  });

  it("accepts a 150 KB body", async () => {
    const big = { ...diagnostics, entries: Array.from({ length: 60 }, () => ({ message: "x".repeat(2500) })) };
    await post({ type: "bug", message: "Crash loop", diagnostics: big }).expect(201);
  });
});
