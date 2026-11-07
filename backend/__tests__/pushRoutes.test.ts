import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const mockSave: jest.Mock<any> = jest.fn();
const mockDelete: jest.Mock<any> = jest.fn();

const TOKEN = "ExponentPushToken[abc_DEF-123]";

describe("Push Routes Integration", () => {
  let app: Express;
  let consoleError: jest.SpiedFunction<typeof console.error>;

  beforeEach(async () => {
    jest.resetModules();
    mockSave.mockReset();
    mockDelete.mockReset();
    mockSave.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    jest.unstable_mockModule("../src/services/pushService.js", () => ({
      EXPO_PUSH_TOKEN: /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$/,
      savePushToken: mockSave,
      deletePushToken: mockDelete,
    }));

    const pushRoutes = (await import("../src/routes/push.js")).default;
    // No global express.json(): the router brings its own parser.
    app = express();
    app.use("/api/push", pushRoutes);
    app.use(errorHandler);
  });

  afterEach(() => { consoleError.mockRestore(); });

  const register = (body: unknown) => request(app).post("/api/push/register").send(body as object);

  it("register saves the token with the app version", async () => {
    const res = await register({ token: TOKEN }).set("x-sirat-app-version", "1.2.0").expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockSave).toHaveBeenCalledWith(TOKEN, "1.2.0");
  });

  it("accepts the ExpoPushToken[...] form too", async () => {
    await register({ token: "ExpoPushToken[xyz]" }).expect(200);
    expect(mockSave).toHaveBeenCalledWith("ExpoPushToken[xyz]", null);
  });

  it.each([
    ["missing token", {}],
    ["wrong prefix", { token: "abc[123]" }],
    ["not a string", { token: 42 }],
    ["too long", { token: `ExpoPushToken[${"a".repeat(201)}]` }],
    ["array body", [TOKEN]],
  ])("register rejects %s with 400 and saves nothing", async (_name, body) => {
    const res = await register(body).expect(400);
    expect(res.body).toEqual({ error: "token not valid" });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("unregister deletes and returns 200 whether or not the row existed", async () => {
    for (let i = 0; i < 2; i++) {
      const res = await request(app).post("/api/push/unregister").send({ token: TOKEN }).expect(200);
      expect(res.body).toEqual({ ok: true });
    }
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith(TOKEN);
  });

  it("unregister rejects an invalid token with 400", async () => {
    await request(app).post("/api/push/unregister").send({ token: "nope" }).expect(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("malformed JSON gets 400 and is never logged", async () => {
    await request(app)
      .post("/api/push/register")
      .set("Content-Type", "application/json")
      .send('{"token":"ExponentPushToken[abc')
      .expect(400);
    expect(consoleError).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("a body over 1kb gets 400 and is never logged", async () => {
    await register({ token: TOKEN, pad: "a".repeat(2000) }).expect(400);
    expect(consoleError).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("a save failure returns 500 and logs only name and code", async () => {
    mockSave.mockRejectedValue(
      Object.assign(new Error(`dup ${TOKEN}`), { name: "PrismaClientKnownRequestError", code: "P2002" }),
    );
    const res = await register({ token: TOKEN }).expect(500);
    expect(res.body).toEqual({ error: "Could not save token" });
    expect(consoleError).toHaveBeenCalledWith("push_register_failed", "PrismaClientKnownRequestError", "P2002");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(TOKEN);
  });

  it("a delete failure returns 500 and logs only name and code", async () => {
    mockDelete.mockRejectedValue(Object.assign(new Error(`x ${TOKEN}`), { code: "P1001" }));
    const res = await request(app).post("/api/push/unregister").send({ token: TOKEN }).expect(500);
    expect(res.body).toEqual({ error: "Could not delete token" });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(TOKEN);
  });
});
