import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetUser: jest.Mock = jest.fn();

describe("getIdentityHash", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetUser.mockReset();
    process.env.CHAT_IDENTITY_SECRET = "test-secret";
    jest.unstable_mockModule("@clerk/express", () => ({
      clerkClient: { users: { getUser: (...a: unknown[]) => mockGetUser(...a) } },
    }));
  });

  const load = async () => (await import("../src/services/chat/identity.js")).getIdentityHash;
  const userWith = (provider: string, providerUserId: string) => ({
    externalAccounts: [{ provider, providerUserId }],
  });

  it("is the same for one Apple ID across two Clerk accounts (delete and sign up again)", async () => {
    (mockGetUser as any).mockImplementation(async () => userWith("oauth_apple", "001234.abcd"));
    const getIdentityHash = await load();

    const first = await getIdentityHash("user_old");
    const second = await getIdentityHash("user_new");

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs between an Apple and a Google ID with the same provider user id", async () => {
    (mockGetUser as any)
      .mockResolvedValueOnce(userWith("oauth_apple", "same"))
      .mockResolvedValueOnce(userWith("oauth_google", "same"));
    const getIdentityHash = await load();

    expect(await getIdentityHash("user_a")).not.toBe(await getIdentityHash("user_b"));
  });

  it("never contains the raw provider id", async () => {
    (mockGetUser as any).mockResolvedValue(userWith("oauth_google", "1098765"));
    const getIdentityHash = await load();

    expect(await getIdentityHash("user_a")).not.toContain("1098765");
  });

  it("falls back to the Clerk user id when there is no external account", async () => {
    (mockGetUser as any).mockResolvedValue({ externalAccounts: [] });
    const getIdentityHash = await load();

    const a = await getIdentityHash("user_a");
    const b = await getIdentityHash("user_b");

    expect(a).not.toBe(b);
  });

  it("caches per user, so Clerk is asked once", async () => {
    (mockGetUser as any).mockResolvedValue(userWith("oauth_apple", "x"));
    const getIdentityHash = await load();

    await getIdentityHash("user_a");
    await getIdentityHash("user_a");

    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});
