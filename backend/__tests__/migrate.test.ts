import { afterEach, describe, expect, it, jest } from "@jest/globals";

describe("runMigrations", () => {
  afterEach(() => { jest.resetModules(); });

  function fakeDb(appliedNames: string[]) {
    const calls: { text: string; params?: unknown[] }[] = [];
    const db = {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        calls.push({ text, params });
        if (text.includes("SELECT name FROM _migrations")) {
          return { rows: appliedNames.map((name) => ({ name })) };
        }
        return { rows: [] };
      }),
    };
    return { db, calls };
  }

  it("applies a pending migration and records it", async () => {
    const { runMigrations } = await import("../src/db/migrate.js");
    const { db, calls } = fakeDb([]);

    const ran = await runMigrations(db as any);

    expect(ran).toEqual(["001_init"]);
    expect(calls.some((c) => c.text.includes("CREATE TABLE IF NOT EXISTS _migrations"))).toBe(true);
    expect(calls.some((c) => c.text.includes("INSERT INTO _migrations") && c.params?.[0] === "001_init")).toBe(true);
    expect(calls.some((c) => c.text === "COMMIT")).toBe(true);
  });

  it("skips a migration that is already applied", async () => {
    const { runMigrations } = await import("../src/db/migrate.js");
    const { db, calls } = fakeDb(["001_init"]);

    const ran = await runMigrations(db as any);

    expect(ran).toEqual([]);
    expect(calls.some((c) => c.text.includes("INSERT INTO _migrations"))).toBe(false);
  });

  it("rolls back when a migration throws", async () => {
    const { runMigrations } = await import("../src/db/migrate.js");
    const calls: string[] = [];
    const db = {
      query: jest.fn(async (text: string) => {
        calls.push(text);
        if (text.includes("SELECT name FROM _migrations")) return { rows: [] };
        if (text.includes("CREATE TABLE IF NOT EXISTS users")) throw new Error("boom");
        return { rows: [] };
      }),
    };

    await expect(runMigrations(db as any)).rejects.toThrow("boom");
    expect(calls).toContain("ROLLBACK");
  });
});
