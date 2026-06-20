import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetAuth: jest.Mock = jest.fn();

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("requireAuth", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetAuth.mockReset();
    jest.unstable_mockModule("@clerk/express", () => ({
      getAuth: mockGetAuth,
      clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
      clerkClient: { users: { deleteUser: jest.fn() } },
    }));
  });

  afterEach(() => { jest.clearAllMocks(); });

  it("sets req.userId and calls next when authenticated", async () => {
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: true, userId: "user_abc" });
    const { requireAuth } = await import("../src/middleware/requireAuth.js");

    const req: any = {};
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.userId).toBe("user_abc");
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 401 when not authenticated", async () => {
    (mockGetAuth as any).mockReturnValue({ isAuthenticated: false, userId: null });
    const { requireAuth } = await import("../src/middleware/requireAuth.js");

    const req: any = {};
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });
});
