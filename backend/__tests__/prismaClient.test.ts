import { describe, expect, it } from "@jest/globals";
import { prisma, withConnectionLimit } from "../src/db/prisma.js";

describe("prisma singleton", () => {
  it("exports a PrismaClient with query/lifecycle methods", () => {
    expect(typeof prisma.$queryRaw).toBe("function");
    expect(typeof prisma.$connect).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
  });

  it("returns the same instance on repeated import", async () => {
    const again = (await import("../src/db/prisma.js")).prisma;
    expect(again).toBe(prisma);
  });
});

describe("withConnectionLimit", () => {
  it("adds a connection_limit to a URL without one", () => {
    expect(withConnectionLimit("postgresql://u:p@h:5432/db", 5)).toBe("postgresql://u:p@h:5432/db?connection_limit=5");
  });

  it("keeps other params", () => {
    expect(withConnectionLimit("postgresql://h/db?sslmode=require", 5)).toBe("postgresql://h/db?sslmode=require&connection_limit=5");
  });

  it("leaves an explicit connection_limit alone", () => {
    expect(withConnectionLimit("postgresql://h/db?connection_limit=9", 5)).toBe("postgresql://h/db?connection_limit=9");
  });

  it("returns an empty URL unchanged", () => {
    expect(withConnectionLimit("", 5)).toBe("");
  });
});
