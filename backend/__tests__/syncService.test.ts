import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockConnect: jest.Mock = jest.fn();
const mockPoolQuery: jest.Mock = jest.fn();

describe("syncService.syncDomains", () => {
  const mockGetUser: jest.Mock = jest.fn();

  const wellFormedClerkUser = {
    primaryEmailAddressId: "e1",
    emailAddresses: [{ id: "e1", emailAddress: "a@b.com" }],
    firstName: "Test",
    lastName: "User",
  };

  beforeEach(() => {
    jest.resetModules();
    mockConnect.mockReset();
    mockPoolQuery.mockReset();
    mockGetUser.mockReset();
    (mockGetUser as any).mockResolvedValue(wellFormedClerkUser);
    jest.unstable_mockModule("../src/db/pool.js", () => ({
      pool: { connect: mockConnect, query: mockPoolQuery },
    }));
    // ensureUser calls clerkClient — mock it to avoid network calls
    jest.unstable_mockModule("@clerk/express", () => ({
      clerkClient: { users: { getUser: mockGetUser } },
    }));
  });

  afterEach(() => { jest.clearAllMocks(); });

  // Builds a fake pooled client. `stored` maps domain -> doc returned by the
  // FOR UPDATE select (absent => empty default).
  function fakeClient(stored: Record<string, unknown>) {
    const writes: { domain: string; doc: unknown }[] = [];
    const log: string[] = [];
    const client = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        log.push(text.trim().split("\n")[0]);
        if (text.includes("SELECT doc FROM sync_documents")) {
          const domain = params![1] as string;
          return domain in stored ? { rows: [{ doc: stored[domain] }] } : { rows: [] };
        }
        if (text.includes("INSERT INTO sync_documents")) {
          writes.push({ domain: params![1] as string, doc: JSON.parse(params![2] as string) });
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    return { client, writes, log };
  }

  it("merges incoming into stored per domain and returns merged docs", async () => {
    const { client, writes } = fakeClient({
      prayer_log: { "2026-06-19": { fajr: { value: "missed", updatedAt: 5 } } },
    });
    (mockConnect as any).mockResolvedValue(client);
    // ensureUser: INSERT returns new row (no profile), then UPDATE
    (mockPoolQuery as any)
      .mockResolvedValueOnce({ rows: [{ email: null, name: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const { syncDomains } = await import("../src/services/syncService.js");

    const result = await syncDomains("user_abc", {
      prayer_log: { "2026-06-19": { fajr: { value: "prayed", updatedAt: 9 } } },
    });

    expect(result.prayer_log["2026-06-19"].fajr).toEqual({ value: "prayed", updatedAt: 9 });
    expect(result.habits).toEqual([]);
    expect(typeof result.syncedAt).toBe("string");
    // prayer_log was written with the merged value
    const prayerWrite = writes.find((w) => w.domain === "prayer_log");
    expect((prayerWrite!.doc as any)["2026-06-19"].fajr.updatedAt).toBe(9);
  });

  it("opens a transaction, ensures the user, commits, and releases", async () => {
    const { client, log } = fakeClient({});
    (mockConnect as any).mockResolvedValue(client);
    // ensureUser: INSERT returns new row (no profile), then UPDATE
    (mockPoolQuery as any)
      .mockResolvedValueOnce({ rows: [{ email: null, name: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const { syncDomains } = await import("../src/services/syncService.js");

    await syncDomains("user_abc", {});

    expect(log).toContain("BEGIN");
    // ensureUser now runs via pool.query (outside transaction) — check pool was called
    expect(mockPoolQuery.mock.calls.some((c: unknown[]) =>
      (c[0] as string).includes("INSERT INTO users"),
    )).toBe(true);
    expect(log).toContain("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back and releases when a query throws", async () => {
    const client = {
      query: jest.fn(async (text: string) => {
        if (text.includes("SELECT doc FROM sync_documents")) throw new Error("db down");
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    (mockConnect as any).mockResolvedValue(client);
    // ensureUser: INSERT returns new row → Clerk called (resolves well-formed user) → UPDATE
    (mockPoolQuery as any)
      .mockResolvedValueOnce({ rows: [{ email: null, name: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const { syncDomains } = await import("../src/services/syncService.js");

    await expect(syncDomains("user_abc", {})).rejects.toThrow("db down");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("surfaces the original error when ROLLBACK also throws", async () => {
    const client = {
      query: jest.fn(async (text: string) => {
        if (text.includes("SELECT doc FROM sync_documents")) throw new Error("db down");
        if (text === "ROLLBACK") throw new Error("rollback failed");
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    (mockConnect as any).mockResolvedValue(client);
    // ensureUser: INSERT returns new row → Clerk called (resolves well-formed user) → UPDATE
    (mockPoolQuery as any)
      .mockResolvedValueOnce({ rows: [{ email: null, name: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const { syncDomains } = await import("../src/services/syncService.js");

    await expect(syncDomains("user_abc", {})).rejects.toThrow("db down");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
