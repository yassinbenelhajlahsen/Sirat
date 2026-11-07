import { describe, expect, it, jest } from "@jest/globals";
import {
  databaseLabel,
  parseAnnounceArgs,
  sendAnnouncement,
} from "../src/services/pushAnnounce.js";

const tokensOf = (n: number) => Array.from({ length: n }, (_, i) => `ExponentPushToken[tok${i}]`);
const msg = { title: "Hi", body: "There" };
const okTickets = (n: number) => ({ data: Array.from({ length: n }, () => ({ status: "ok" })) });

function reply(status: number, json: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => json } as Response;
}

function setup(responses: Array<Response | Error | ((body: unknown[]) => Response)>) {
  const queue = [...responses];
  const fetchImpl = jest.fn(async (_url: unknown, init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(JSON.parse(init!.body as string)) : next;
  });
  const sleep = jest.fn(async (_ms: number) => {});
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls: fetchImpl, sleep };
}

describe("parseAnnounceArgs", () => {
  it("defaults to a dry run", () => {
    expect(parseAnnounceArgs(["--title", "Hi", "--body", "There"])).toEqual({
      title: "Hi",
      body: "There",
      mode: "dry",
    });
  });

  it("reads --test and --all", () => {
    expect(parseAnnounceArgs(["--title", "a", "--body", "b", "--test"])).toHaveProperty("mode", "test");
    expect(parseAnnounceArgs(["--all", "--title", "a", "--body", "b"])).toHaveProperty("mode", "all");
  });

  it("trims title and body", () => {
    expect(parseAnnounceArgs(["--title", " a ", "--body", " b "])).toMatchObject({ title: "a", body: "b" });
  });

  it.each([
    [["--body", "x"]],
    [["--title", "x"]],
    [["--title", "x", "--body", "y", "--test", "--all"]],
    [["--title", "", "--body", "y"]],
    [["--title", "x".repeat(101), "--body", "y"]],
    [["--title", "x", "--body", "y".repeat(501)]],
    [["--title", "x", "--body"]],
  ])("refuses %j", (argv) => {
    expect(parseAnnounceArgs(argv)).toHaveProperty("error");
  });
});

describe("databaseLabel", () => {
  it.each([
    ["postgresql://u:p@localhost:5432/sirat_dev", "local database"],
    ["postgresql://u:p@127.0.0.1/x", "local database"],
    ["postgresql://u:p@[::1]:5432/x", "local database"],
    ["postgresql://u:p@monorail.proxy.rlwy.net:123/railway", "remote database"],
    ["", "local database"],
    ["not a url", "local database"],
  ])("labels %j as %s", (url, label) => {
    expect(databaseLabel(url)).toBe(label);
  });
});

describe("sendAnnouncement", () => {
  it("sends 250 tokens as batches of 100, 100, 50 with the fixed payload", async () => {
    const tokens = tokensOf(250);
    const { fetchImpl, calls, sleep } = setup([
      reply(200, okTickets(100)),
      reply(200, okTickets(100)),
      reply(200, okTickets(50)),
    ]);

    const result = await sendAnnouncement(tokens, msg, { fetchImpl, sleep });

    expect(result).toEqual({ sent: 250, accepted: 250, errors: 0, deadTokens: [] });
    expect(calls).toHaveBeenCalledTimes(3);
    const bodies = calls.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(bodies.flat()).toEqual(
      tokens.map((to) => ({ to, title: "Hi", body: "There", sound: "default" })),
    );
    const [url, init] = calls.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", Accept: "application/json" });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(200);
  });

  it("adds Authorization only when an access token is given", async () => {
    const without = setup([reply(200, okTickets(1))]);
    await sendAnnouncement(tokensOf(1), msg, { fetchImpl: without.fetchImpl, sleep: without.sleep });
    const withToken = setup([reply(200, okTickets(1))]);
    await sendAnnouncement(tokensOf(1), msg, {
      fetchImpl: withToken.fetchImpl,
      sleep: withToken.sleep,
      accessToken: "secret",
    });

    const headersOf = (s: ReturnType<typeof setup>) => (s.calls.mock.calls[0][1] as RequestInit).headers;
    expect(headersOf(without)).not.toHaveProperty("Authorization");
    expect(headersOf(withToken)).toHaveProperty("Authorization", "Bearer secret");
  });

  it("counts ok tickets as accepted and collects DeviceNotRegistered tokens by index", async () => {
    const tokens = tokensOf(3);
    const { fetchImpl, sleep } = setup([
      reply(200, {
        data: [
          { status: "ok" },
          { status: "error", details: { error: "DeviceNotRegistered" } },
          { status: "error", details: { error: "MessageRateExceeded" } },
        ],
      }),
    ]);

    expect(await sendAnnouncement(tokens, msg, { fetchImpl, sleep })).toEqual({
      sent: 3,
      accepted: 1,
      errors: 2,
      deadTokens: [tokens[1]],
    });
  });

  it("retries 429 then succeeds without double counting", async () => {
    const { fetchImpl, calls, sleep } = setup([reply(429), reply(200, okTickets(2))]);

    expect(await sendAnnouncement(tokensOf(2), msg, { fetchImpl, sleep })).toEqual({
      sent: 2,
      accepted: 2,
      errors: 0,
      deadTokens: [],
    });
    expect(calls).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("after 3 failed attempts counts the batch as errors and moves on to the next batch", async () => {
    const { fetchImpl, calls, sleep } = setup([
      reply(500),
      reply(500),
      reply(500),
      reply(200, okTickets(20)),
    ]);

    expect(await sendAnnouncement(tokensOf(120), msg, { fetchImpl, sleep })).toEqual({
      sent: 120,
      accepted: 20,
      errors: 100,
      deadTokens: [],
    });
    expect(calls).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("treats a thrown fetch (timeout/offline) like a 5xx", async () => {
    const { fetchImpl, calls, sleep } = setup([new Error("offline"), reply(200, okTickets(1))]);

    expect(await sendAnnouncement(tokensOf(1), msg, { fetchImpl, sleep })).toMatchObject({ accepted: 1, errors: 0 });
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it("does not retry other non-OK statuses", async () => {
    const { fetchImpl, calls, sleep } = setup([reply(400)]);

    expect(await sendAnnouncement(tokensOf(2), msg, { fetchImpl, sleep })).toEqual({
      sent: 2,
      accepted: 0,
      errors: 2,
      deadTokens: [],
    });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("counts a 200 with the wrong number of tickets as batch errors", async () => {
    const { fetchImpl, sleep } = setup([reply(200, okTickets(1)), reply(200, { data: "nope" })]);

    expect(await sendAnnouncement(tokensOf(2), msg, { fetchImpl, sleep })).toEqual({
      sent: 2,
      accepted: 0,
      errors: 2,
      deadTokens: [],
    });
  });

  it("never puts a token in a thrown error or return value other than deadTokens", async () => {
    const tokens = tokensOf(2);
    const { fetchImpl, sleep } = setup([new Error("offline"), new Error("offline"), new Error("offline")]);

    const result = await sendAnnouncement(tokens, msg, { fetchImpl, sleep });

    expect(JSON.stringify(result)).not.toContain("ExponentPushToken");
  });
});
