import { describe, expect, it, jest, beforeEach } from "@jest/globals";

const mockQuery: jest.Mock = jest.fn();
const mockGetUser: jest.Mock = jest.fn();

describe("ensureUser", () => {
  beforeEach(() => {
    jest.resetModules();
    mockQuery.mockReset();
    mockGetUser.mockReset();
    jest.unstable_mockModule("../src/db/pool.js", () => ({
      pool: { query: (...a: unknown[]) => mockQuery(...a) },
    }));
    jest.unstable_mockModule("@clerk/express", () => ({
      clerkClient: { users: { getUser: (...a: unknown[]) => mockGetUser(...a) } },
    }));
  });

  const loadService = async () => await import("../src/services/userService.js");

  it("inserts the row and fills name/email from Clerk on a new user", async () => {
    // INSERT ... RETURNING returns a row => brand new
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: null, name: null }] });
    (mockQuery as any).mockResolvedValueOnce({ rows: [] }); // the UPDATE
    (mockGetUser as any).mockResolvedValue({
      primaryEmailAddressId: "e1",
      emailAddresses: [{ id: "e1", emailAddress: "a@b.com" }],
      firstName: "Sara",
      lastName: "Khan",
    });

    const { ensureUser } = await loadService();
    await ensureUser("user_123");

    expect(mockGetUser).toHaveBeenCalledWith("user_123");
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE users/i);
    expect(updateCall[1]).toEqual(["user_123", "a@b.com", "Sara Khan"]);
  });

  it("does not call Clerk when the existing row already has name and email", async () => {
    (mockQuery as any).mockResolvedValueOnce({ rows: [] }); // INSERT conflict -> no row
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: "a@b.com", name: "Sara Khan" }] }); // SELECT
    const { ensureUser } = await loadService();
    await ensureUser("user_123");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("swallows Clerk errors and leaves the row as-is", async () => {
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: null, name: null }] });
    (mockGetUser as any).mockRejectedValue(new Error("clerk down"));
    const { ensureUser } = await loadService();
    await expect(ensureUser("user_123")).resolves.toBeUndefined();
  });
});
