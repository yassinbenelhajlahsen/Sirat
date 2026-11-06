import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const mockGetAuth: jest.Mock = jest.fn();
const mockDeleteUser: jest.Mock = jest.fn();
const mockQuery: jest.Mock = jest.fn();
const mockDeleteReports: jest.Mock = jest.fn();
const mockGetUser: jest.Mock = jest.fn();
const mockRemoveContact: jest.Mock = jest.fn();

describe("Account Routes Integration", () => {
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockGetAuth.mockReset();
    mockDeleteUser.mockReset();
    mockQuery.mockReset();
    mockDeleteReports.mockReset();
    (mockDeleteReports as any).mockResolvedValue({ count: 0 });
    mockGetUser.mockReset();
    (mockGetUser as any).mockResolvedValue({
      emailAddresses: [{ emailAddress: "a@b.co" }, { emailAddress: "c@d.co" }],
    });
    mockRemoveContact.mockReset();
    (mockRemoveContact as any).mockResolvedValue(undefined);
    jest.unstable_mockModule("../src/services/contactService.js", () => ({
      removeContact: (...a: unknown[]) => mockRemoveContact(...a),
    }));
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    (mockDeleteUser as any).mockResolvedValue({});
    (mockQuery as any).mockResolvedValue({ rows: [] });

    jest.unstable_mockModule("@clerk/express", () => ({
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      getAuth: mockGetAuth,
      clerkClient: { users: { deleteUser: mockDeleteUser, getUser: mockGetUser } },
    }));
    jest.unstable_mockModule("../src/db/pool.js", () => ({
      pool: { query: mockQuery },
    }));
    jest.unstable_mockModule("../src/db/prisma.js", () => ({
      prisma: { feedbackReport: { deleteMany: mockDeleteReports } },
    }));

    const accountRoutes = (await import("../src/routes/account.js")).default;
    app = express();
    app.use("/api/account", accountRoutes);
    app.use(errorHandler);
  });

  afterEach(() => { jest.clearAllMocks(); });

  it("deletes DB rows and the Clerk user, returns 200", async () => {
    const res = await request(app).delete("/api/account").expect(200);

    expect(res.body).toEqual({ deleted: true });
    expect(mockQuery).toHaveBeenCalledWith(`DELETE FROM users WHERE id = $1`, ["user_abc"]);
    expect(mockDeleteUser).toHaveBeenCalledWith("user_abc");
  });

  it("deletes the user's feedback reports", async () => {
    await request(app).delete("/api/account").expect(200);

    expect(mockDeleteReports).toHaveBeenCalledWith({ where: { userId: "user_abc" } });
  });

  it("removes each of the user's addresses from the mailing list before the Clerk user goes", async () => {
    await request(app).delete("/api/account").expect(200);

    expect(mockRemoveContact).toHaveBeenCalledWith("a@b.co");
    expect(mockRemoveContact).toHaveBeenCalledWith("c@d.co");
    expect(mockGetUser.mock.invocationCallOrder[0]).toBeLessThan(mockDeleteUser.mock.invocationCallOrder[0]);
  });

  it("still deletes the account when the mailing list removal fails, without logging addresses", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    (mockRemoveContact as any).mockRejectedValue(new Error("resend down for a@b.co"));

    await request(app).delete("/api/account").expect(200);

    expect(mockDeleteUser).toHaveBeenCalledWith("user_abc");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("a@b.co");
    spy.mockRestore();
  });

  it("still deletes the account when Clerk can't return the addresses", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    (mockGetUser as any).mockRejectedValue(new Error("clerk down"));

    await request(app).delete("/api/account").expect(200);

    expect(mockDeleteUser).toHaveBeenCalledWith("user_abc");
    spy.mockRestore();
  });

  it("tolerates a Clerk 404 (already deleted) and still returns 200", async () => {
    (mockDeleteUser as any).mockRejectedValue({ status: 404 });

    const res = await request(app).delete("/api/account").expect(200);

    expect(res.body).toEqual({ deleted: true });
    expect(mockQuery).toHaveBeenCalledWith(`DELETE FROM users WHERE id = $1`, ["user_abc"]);
  });

  it("returns 401 when unauthenticated", async () => {
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: false, userId: null });

    await request(app).delete("/api/account").expect(401);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("returns 500 when a non-404 Clerk error occurs", async () => {
    (mockDeleteUser as any).mockRejectedValue({ status: 500 });

    const res = await request(app).delete("/api/account").expect(500);

    expect(res.body).toEqual({ error: "Account deletion failed" });
    expect(mockQuery).toHaveBeenCalled();
  });
});
