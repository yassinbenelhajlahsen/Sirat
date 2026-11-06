import { describe, expect, it, jest, beforeEach } from "@jest/globals";

const mockQuery: jest.Mock = jest.fn();
const mockGetUser: jest.Mock = jest.fn();
const mockAddContact: jest.Mock = jest.fn();

describe("ensureUser", () => {
  beforeEach(() => {
    jest.resetModules();
    mockQuery.mockReset();
    mockGetUser.mockReset();
    mockAddContact.mockReset();
    (mockAddContact as any).mockResolvedValue(undefined);
    jest.unstable_mockModule("../src/services/contactService.js", () => ({
      addContact: (...a: unknown[]) => mockAddContact(...a),
    }));
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

  const clerkUser = {
    primaryEmailAddressId: "e1",
    emailAddresses: [{ id: "e1", emailAddress: "a@b.com" }],
    firstName: "Sara",
    lastName: "Khan",
  };

  it("adds a new user to the mailing list", async () => {
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: null, name: null }] });
    (mockQuery as any).mockResolvedValueOnce({ rows: [] });
    (mockGetUser as any).mockResolvedValue(clerkUser);
    const { ensureUser } = await loadService();
    await ensureUser("user_123");
    expect(mockAddContact).toHaveBeenCalledWith({ email: "a@b.com", firstName: "Sara", lastName: "Khan" });
  });

  it("adds an existing user whose email was still missing", async () => {
    (mockQuery as any).mockResolvedValueOnce({ rows: [] });
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: null, name: "Sara Khan" }] });
    (mockQuery as any).mockResolvedValueOnce({ rows: [] });
    (mockGetUser as any).mockResolvedValue(clerkUser);
    const { ensureUser } = await loadService();
    await ensureUser("user_123");
    expect(mockAddContact).toHaveBeenCalledTimes(1);
  });

  it("does not touch the mailing list when only the name is missing", async () => {
    (mockQuery as any).mockResolvedValueOnce({ rows: [] });
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: "a@b.com", name: null }] });
    (mockQuery as any).mockResolvedValueOnce({ rows: [] });
    (mockGetUser as any).mockResolvedValue(clerkUser);
    const { ensureUser } = await loadService();
    await ensureUser("user_123");
    expect(mockAddContact).not.toHaveBeenCalled();
    expect(mockQuery.mock.calls[2][0]).toMatch(/UPDATE users/i);
  });

  it("skips the mailing list when Clerk has no email", async () => {
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: null, name: null }] });
    (mockQuery as any).mockResolvedValueOnce({ rows: [] });
    (mockGetUser as any).mockResolvedValue({ ...clerkUser, emailAddresses: [] });
    const { ensureUser } = await loadService();
    await ensureUser("user_123");
    expect(mockAddContact).not.toHaveBeenCalled();
  });

  it("leaves the email unsaved when adding fails, so the next sync retries", async () => {
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: null, name: null }] });
    (mockGetUser as any).mockResolvedValue(clerkUser);
    (mockAddContact as any).mockRejectedValue(new Error("resend down"));
    const { ensureUser } = await loadService();
    await expect(ensureUser("user_123")).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("logs why a mailing list add failed", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    (mockQuery as any).mockResolvedValueOnce({ rows: [{ email: null, name: null }] });
    (mockGetUser as any).mockResolvedValue(clerkUser);
    (mockAddContact as any).mockRejectedValue(new Error("Resend contact create responded 422"));
    const { ensureUser } = await loadService();
    await ensureUser("user_123");
    expect(JSON.stringify(spy.mock.calls)).toContain("Resend contact create responded 422");
    spy.mockRestore();
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
