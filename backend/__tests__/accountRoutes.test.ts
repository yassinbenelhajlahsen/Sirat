import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const mockGetAuth: jest.Mock = jest.fn();
const mockDeleteUser: jest.Mock = jest.fn();
const mockQuery: jest.Mock = jest.fn();

describe("Account Routes Integration", () => {
  let app: Express;

  beforeEach(async () => {
    jest.resetModules();
    mockGetAuth.mockReset();
    mockDeleteUser.mockReset();
    mockQuery.mockReset();
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    (mockDeleteUser as any).mockResolvedValue({});
    (mockQuery as any).mockResolvedValue({ rows: [] });

    jest.unstable_mockModule("@clerk/express", () => ({
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      getAuth: mockGetAuth,
      clerkClient: { users: { deleteUser: mockDeleteUser } },
    }));
    jest.unstable_mockModule("../src/db/pool.js", () => ({
      pool: { query: mockQuery },
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

  it("tolerates a Clerk 404 (already deleted) and still returns 200", async () => {
    (mockDeleteUser as any).mockRejectedValue({ status: 404 });

    const res = await request(app).delete("/api/account").expect(200);

    expect(res.body).toEqual({ deleted: true });
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
  });
});
