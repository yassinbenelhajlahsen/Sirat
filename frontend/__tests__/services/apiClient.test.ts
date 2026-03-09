import { DeviceEventEmitter } from "react-native";
import { apiFetch, apiPost, AppUpdateRequiredError } from "@/services/apiClient";

jest.mock("@/services/appVersion", () => ({
  getVersionHeaders: () => ({
    "x-sirat-app-version": "1.0.10",
    "x-sirat-platform": "ios",
    "x-sirat-app-ownership": "standalone",
  }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe("apiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("attaches version headers to every request", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { result: "ok" }));

    await apiFetch("/api/test");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-sirat-app-version": "1.0.10",
          "x-sirat-platform": "ios",
          "x-sirat-app-ownership": "standalone",
        }),
      }),
    );
  });

  it("returns parsed body on successful response", async () => {
    const body = { data: "hello" };
    mockFetch.mockResolvedValue(makeResponse(200, body));

    const result = await apiFetch("/api/test");
    expect(result).toEqual(body);
  });

  it("emits FORCE_UPDATE_REQUIRED and throws AppUpdateRequiredError on 426", async () => {
    const payload = {
      error: {
        code: "APP_UPDATE_REQUIRED",
        minVersion: "2.0.0",
        currentVersion: "1.0.0",
        retriable: false,
      },
    };
    mockFetch.mockResolvedValue(makeResponse(426, payload));
    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    await expect(apiFetch("/api/dua")).rejects.toThrow(AppUpdateRequiredError);

    expect(emitSpy).toHaveBeenCalledWith("FORCE_UPDATE_REQUIRED", {
      minVersion: "2.0.0",
      currentVersion: "1.0.0",
    });
  });

  it("throws on non-ok responses with error message from body", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(400, { error: "Request too short" }),
    );

    await expect(apiFetch("/api/dua")).rejects.toThrow("Request too short");
  });

  it("throws generic message when error body is not a string", async () => {
    mockFetch.mockResolvedValue(makeResponse(500, { error: { detail: "oops" } }));

    await expect(apiFetch("/api/dua")).rejects.toThrow("API error (500)");
  });

  it("apiPost sends POST with JSON body", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { dua: {} }));

    await apiPost("/api/dua", { userRequest: "help me" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userRequest: "help me" }),
      }),
    );
  });
});
