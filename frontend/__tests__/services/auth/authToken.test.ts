import { getAuthToken } from "@/services/auth/authToken";

const mockGetToken = jest.fn();
const mockGetClerkInstance = jest.fn();

jest.mock("@clerk/expo", () => ({
  getClerkInstance: () => mockGetClerkInstance(),
}));

describe("getAuthToken", () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    mockGetClerkInstance.mockReset();
  });

  it("returns the session token when signed in", async () => {
    mockGetToken.mockResolvedValue("jwt-123");
    mockGetClerkInstance.mockReturnValue({ session: { getToken: mockGetToken } });
    await expect(getAuthToken()).resolves.toBe("jwt-123");
  });

  it("returns null when there is no active session", async () => {
    mockGetClerkInstance.mockReturnValue({ session: null });
    await expect(getAuthToken()).resolves.toBeNull();
  });

  it("returns null when token retrieval throws", async () => {
    mockGetToken.mockRejectedValue(new Error("boom"));
    mockGetClerkInstance.mockReturnValue({ session: { getToken: mockGetToken } });
    await expect(getAuthToken()).resolves.toBeNull();
  });
});
