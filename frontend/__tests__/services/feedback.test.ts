const mockApiPost = jest.fn();
const mockReport = { context: { os: "iOS", osVersion: "18.1", deviceModel: "iPhone15,2", updateId: null }, entries: [] };

jest.mock("@/services/apiClient", () => ({ apiPost: (...args: unknown[]) => mockApiPost(...args) }));
jest.mock("@/services/diagnostics", () => ({ getDiagnosticsReport: async () => mockReport }));
jest.mock("@/services/prayerSettings", () => ({
  getEffectivePrayerSettings: async () => mockSettings(),
}));
jest.mock("@/services/notifications/storage", () => ({ readMasterEnabled: async () => true }));

let mockSettings: () => unknown = () => ({ method: 2, useLocation: true, city: { name: "Secret City" } });

import { submitFeedback } from "@/services/feedback";

beforeEach(() => {
  mockApiPost.mockReset();
  mockApiPost.mockResolvedValue({ id: "rep_1" });
});

it("feedback posts without diagnostics", async () => {
  await submitFeedback({ type: "feedback", message: "  Love it  ", email: "a@b.co" });
  expect(mockApiPost).toHaveBeenCalledWith("/api/feedback", { type: "feedback", message: "Love it", email: "a@b.co" });
});

it("bug posts with diagnostics", async () => {
  await submitFeedback({ type: "bug", message: "Crash", email: "a@b.co" });
  expect(mockApiPost).toHaveBeenCalledWith("/api/feedback", {
    type: "bug",
    message: "Crash",
    email: "a@b.co",
    diagnostics: {
      ...mockReport,
      context: { ...mockReport.context, prayerMethod: 2, locationOn: true, notificationsOn: true },
    },
  });
});

it("never sends the city with the settings", async () => {
  await submitFeedback({ type: "bug", message: "Crash", email: "" });
  expect(JSON.stringify(mockApiPost.mock.calls[0][1])).not.toContain("Secret City");
});

it("still sends the bug report if settings can't be read", async () => {
  mockSettings = () => { throw new Error("no storage"); };
  await submitFeedback({ type: "bug", message: "Crash", email: "" });
  expect(mockApiPost.mock.calls[0][1].diagnostics.context.os).toBe("iOS");
  mockSettings = () => ({ method: 2, useLocation: true });
});

it("empty email is omitted", async () => {
  await submitFeedback({ type: "feedback", message: "Hi", email: "   " });
  expect(mockApiPost).toHaveBeenCalledWith("/api/feedback", { type: "feedback", message: "Hi" });
});

it("rejects when the request fails", async () => {
  mockApiPost.mockRejectedValue(new Error("API error (500)"));
  await expect(submitFeedback({ type: "feedback", message: "Hi", email: "" })).rejects.toThrow();
});
