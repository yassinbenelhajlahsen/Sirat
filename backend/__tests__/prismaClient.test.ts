import { describe, expect, it } from "@jest/globals";
import { prisma } from "../src/db/prisma.js";

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
