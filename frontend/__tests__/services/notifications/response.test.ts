import * as Notifications from "expo-notifications";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

function makeResponse(identifier: string, data: Record<string, unknown> | null) {
  return { notification: { request: { identifier, content: { data } } } } as any;
}

describe("notifications/response", () => {
  let routeNotificationResponse: typeof import("@/services/notifications/response").routeNotificationResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      routeNotificationResponse =
        require("@/services/notifications/response").routeNotificationResponse;
    });
  });

  it("navigates to data.url", () => {
    routeNotificationResponse(
      makeResponse("a", { type: "friday", url: "/Quran?surah=18&ayah=1" }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/Quran?surah=18&ayah=1");
  });

  it("routes one response only once", () => {
    const response = makeResponse("a", { url: "/Quran?surah=18&ayah=1" });
    routeNotificationResponse(response);
    routeNotificationResponse(response);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("clears the last response so a reload does not replay it", () => {
    routeNotificationResponse(makeResponse("a", { url: "/Quran" }));
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["prayer notifications", { type: "prayer", label: "Fajr" }],
    ["no data", null],
    ["a non-string url", { url: 5 }],
    ["an external url", { url: "https://example.com" }],
  ])("does not navigate for %s", (_name, data) => {
    routeNotificationResponse(makeResponse("b", data));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("ignores a null response", () => {
    routeNotificationResponse(null);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
