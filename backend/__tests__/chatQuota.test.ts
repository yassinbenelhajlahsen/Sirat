import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// In-memory stand-in for chat_usage that honours the SQL the quota module sends.
type Row = { identityHash: string; month: string; allowance: number; used: number };
let rows: Row[] = [];
const find = (identityHash: string, month: string) =>
  rows.find((r) => r.identityHash === identityHash && r.month === month);

const sqlOf = (strings: TemplateStringsArray) => strings.join("?");

const fakePrisma = {
  chatUsage: {
    findUnique: async ({ where }: any) => {
      const r = find(where.identityHash_month.identityHash, where.identityHash_month.month);
      return r ? { ...r } : null;
    },
    createMany: async ({ data, skipDuplicates }: any) => {
      const exists = find(data.identityHash, data.month);
      if (exists && !skipDuplicates) throw new Error("duplicate");
      if (!exists) rows.push({ used: 0, ...data });
      return { count: exists ? 0 : 1 };
    },
    deleteMany: async ({ where }: any) => {
      const before = rows.length;
      rows = rows.filter((r) => !(r.month < where.month.lt));
      return { count: before - rows.length };
    },
  },
  $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
    const sql = sqlOf(strings);
    if (/SET used = used \+ 1/.test(sql) && /used < allowance/.test(sql)) {
      const r = find(values[0], values[1]);
      if (!r || r.used >= r.allowance) return [];
      r.used += 1;
      return [{ allowance: r.allowance, used: r.used }];
    }
    throw new Error(`unexpected query: ${sql}`);
  },
  $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
    const sql = sqlOf(strings);
    if (/GREATEST\(used - 1, 0\)/.test(sql)) {
      const r = find(values[0], values[1]);
      if (r) r.used = Math.max(r.used - 1, 0);
      return r ? 1 : 0;
    }
    throw new Error(`unexpected statement: ${sql}`);
  },
};

describe("chat quota", () => {
  beforeEach(() => {
    jest.resetModules();
    rows = [];
    jest.useFakeTimers({ now: new Date("2026-11-15T12:00:00Z"), doNotFake: ["nextTick", "setImmediate"] });
    jest.unstable_mockModule("../src/db/prisma.js", () => ({ prisma: fakePrisma }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const load = async () => await import("../src/services/chat/quota.js");

  it("uses the UTC calendar month", async () => {
    const { currentMonth, resetsAt } = await load();
    const lastSecond = new Date("2026-12-31T23:59:59Z");

    expect(currentMonth(lastSecond)).toBe("2026-12");
    expect(resetsAt(lastSecond)).toBe("2027-01-01T00:00:00.000Z");
  });

  it("does not ask for a decision when this month's row already exists", async () => {
    rows.push({ identityHash: "h", month: "2026-11", allowance: 15, used: 3 });
    const { ensureAllowance } = await load();
    const decide = jest.fn(async () => 5);

    await ensureAllowance("h", decide);

    expect(decide).not.toHaveBeenCalled();
    expect(find("h", "2026-11")).toMatchObject({ allowance: 15, used: 3 });
  });

  it("creates this month's row with the decided allowance", async () => {
    const { ensureAllowance, getUsage } = await load();

    await ensureAllowance("h", async () => 5);

    expect(await getUsage("h")).toEqual({ allowance: 5, used: 0 });
  });

  it("does not count last month's row toward this month", async () => {
    rows.push({ identityHash: "h", month: "2026-10", allowance: 15, used: 15 });
    const { getUsage } = await load();

    expect(await getUsage("h")).toBeNull();
  });

  it("claims until the allowance is used, then returns null", async () => {
    rows.push({ identityHash: "h", month: "2026-11", allowance: 15, used: 14 });
    const { claimMessage } = await load();

    expect(await claimMessage("h")).toEqual({ allowance: 15, used: 15 });
    expect(await claimMessage("h")).toBeNull();
    expect(find("h", "2026-11")!.used).toBe(15);
  });

  it("refunds into the month the claim was made in", async () => {
    rows.push({ identityHash: "h", month: "2026-10", allowance: 15, used: 4 });
    rows.push({ identityHash: "h", month: "2026-11", allowance: 15, used: 4 });
    const { refundMessage } = await load();

    await refundMessage("h", "2026-10");

    expect(find("h", "2026-10")!.used).toBe(3);
    expect(find("h", "2026-11")!.used).toBe(4);
  });

  it("never refunds below zero", async () => {
    rows.push({ identityHash: "h", month: "2026-11", allowance: 15, used: 0 });
    const { refundMessage } = await load();

    await refundMessage("h");

    expect(find("h", "2026-11")!.used).toBe(0);
  });

  it("purges rows from earlier months once, when the first allowance of the month is ensured", async () => {
    rows.push({ identityHash: "old", month: "2026-10", allowance: 15, used: 2 });
    const { ensureAllowance } = await load();

    await ensureAllowance("h", async () => 15);

    expect(find("old", "2026-10")).toBeUndefined();
    expect(find("h", "2026-11")).toBeDefined();
  });
});
