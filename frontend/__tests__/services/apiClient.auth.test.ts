import { apiFetch } from "@/services/apiClient";

jest.mock("@/services/appVersion", () => ({
  getVersionHeaders: () => ({ "x-sirat-app-version": "1.1.0" }),
}));

const mockGetAuthToken = jest.fn();
jest.mock("@/services/auth/authToken", () => ({
  getAuthToken: () => mockGetAuthToken(),
}));

describe("apiClient auth header", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    mockGetAuthToken.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    (global as any).fetch = fetchMock;
  });

  it("adds a Bearer header when a token is present", async () => {
    mockGetAuthToken.mockResolvedValue("jwt-123");
    await apiFetch("/api/sync", { method: "POST", body: {} });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer jwt-123");
  });

  it("omits the Bearer header when there is no token", async () => {
    mockGetAuthToken.mockResolvedValue(null);
    await apiFetch("/api/app/version");
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });
});
