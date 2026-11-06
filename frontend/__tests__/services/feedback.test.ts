const mockApiPost = jest.fn();
const mockReport = { context: { os: "iOS", osVersion: "18.1", deviceModel: "iPhone15,2", updateId: null }, entries: [] };

jest.mock("@/services/apiClient", () => ({ apiPost: (...args: unknown[]) => mockApiPost(...args) }));
jest.mock("@/services/diagnostics", () => ({ getDiagnosticsReport: async () => mockReport }));
jest.mock("@/services/prayerSettings", () => ({
  getEffectivePrayerSettings: async () => mockSettings(),
}));
jest.mock("@/services/notifications/storage", () => ({ readMasterEnabled: async () => true }));
jest.mock("@/services/auth/authToken", () => ({ getAuthToken: async () => mockToken }));

let mockSettings: () => unknown = () => ({ method: 2, useLocation: true, city: { name: "Secret City" } });
let mockToken: string | null = "secret-jwt";

import { submitFeedback } from "@/services/feedback";

beforeEach(() => {
  mockApiPost.mockReset();
  mockApiPost.mockResolvedValue({ id: "rep_1" });
});

it("feedback posts without diagnostics", async () => {
  await submitFeedback({ type: "feedback", message: "  Love it  ", email: "a@b.co", signedIn: true });
  expect(mockApiPost).toHaveBeenCalledWith("/api/feedback", { type: "feedback", message: "Love it", email: "a@b.co" });
});

it("bug posts with diagnostics", async () => {
  await submitFeedback({ type: "bug", message: "Crash", email: "a@b.co", signedIn: true });
  expect(mockApiPost).toHaveBeenCalledWith("/api/feedback", {
    type: "bug",
    message: "Crash",
    email: "a@b.co",
    diagnostics: {
      ...mockReport,
      context: {
        ...mockReport.context,
        signedIn: true,
        hasAuthToken: true,
        prayerMethod: 2,
        locationOn: true,
        notificationsOn: true,
      },
    },
  });
});

it("reports a signed-in user whose token is missing", async () => {
  mockToken = null;
  await submitFeedback({ type: "bug", message: "Crash", email: "", signedIn: true });
  expect(mockApiPost.mock.calls[0][1].diagnostics.context).toMatchObject({ signedIn: true, hasAuthToken: false });
  mockToken = "secret-jwt";
});

it("never sends the token itself in diagnostics", async () => {
  await submitFeedback({ type: "bug", message: "Crash", email: "", signedIn: true });
  expect(JSON.stringify(mockApiPost.mock.calls[0][1])).not.toContain("secret-jwt");
});

it("never sends the city with the settings", async () => {
  await submitFeedback({ type: "bug", message: "Crash", email: "", signedIn: false });
  expect(JSON.stringify(mockApiPost.mock.calls[0][1])).not.toContain("Secret City");
});

it("keeps the sign-in state if settings can't be read", async () => {
  mockSettings = () => { throw new Error("no storage"); };
  await submitFeedback({ type: "bug", message: "Crash", email: "", signedIn: false });
  expect(mockApiPost.mock.calls[0][1].diagnostics.context).toMatchObject({ os: "iOS", signedIn: false });
  mockSettings = () => ({ method: 2, useLocation: true });
});

it("empty email is omitted", async () => {
  await submitFeedback({ type: "feedback", message: "Hi", email: "   ", signedIn: false });
  expect(mockApiPost).toHaveBeenCalledWith("/api/feedback", { type: "feedback", message: "Hi" });
});

it("rejects when the request fails", async () => {
  mockApiPost.mockRejectedValue(new Error("API error (500)"));
  await expect(submitFeedback({ type: "feedback", message: "Hi", email: "", signedIn: false })).rejects.toThrow();
});
