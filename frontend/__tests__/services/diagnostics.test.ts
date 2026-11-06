import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("expo-device", () => ({ osName: "iOS", osVersion: "18.1", modelId: "iPhone15,2", modelName: "iPhone 14 Pro" }));
jest.mock("expo-updates", () => ({ updateId: "upd-1" }));

type Diagnostics = typeof import("@/services/diagnostics");

const STORAGE_KEY = "diagnostics_log_v1";
const originalConsoleError = console.error;
const originalErrorUtils = (global as any).ErrorUtils;

let previousHandler: jest.Mock;
let installedHandler: ((error: unknown, isFatal?: boolean) => void) | null;

function load(): Diagnostics {
  let mod: Diagnostics | undefined;
  jest.isolateModules(() => {
    mod = require("@/services/diagnostics");
  });
  return mod!;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  previousHandler = jest.fn();
  installedHandler = null;
  (global as any).ErrorUtils = {
    getGlobalHandler: () => previousHandler,
    setGlobalHandler: (h: typeof installedHandler) => { installedHandler = h; },
  };
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  (global as any).ErrorUtils = originalErrorUtils;
});

it("keeps the newest 50 entries", async () => {
  const d = load();
  for (let i = 1; i <= 60; i++) d.recordError("error", new Error(`e${i}`));
  const { entries } = await d.getDiagnosticsReport();
  expect(entries).toHaveLength(50);
  expect(entries[0].message).toBe("e11");
  expect(entries[49].message).toBe("e60");
});

it("cuts message to 500 and stack to 2000 chars", async () => {
  const d = load();
  const err = new Error("m".repeat(900));
  err.stack = "s".repeat(5000);
  d.recordError("error", err);
  const [entry] = (await d.getDiagnosticsReport()).entries;
  expect(entry.message).toHaveLength(500);
  expect(entry.stack).toHaveLength(2000);
});

it("keeps only the last 10 screens", async () => {
  const d = load();
  d.recordError("error", new Error("before"));
  for (let i = 1; i <= 15; i++) d.recordScreen(`/s${i}`);
  const { entries } = await d.getDiagnosticsReport();
  const screens = entries.filter((e) => e.kind === "screen");
  expect(screens.map((s) => s.message)).toEqual(Array.from({ length: 10 }, (_, i) => `/s${i + 6}`));
  expect(entries[0].message).toBe("before");
});

it("records console.error and still calls the original", async () => {
  const original = console.error as jest.Mock;
  const d = load();
  d.installDiagnostics();
  console.error("Sync failed", new Error("offline"));
  expect(original).toHaveBeenCalledWith("Sync failed", expect.any(Error));
  const [entry] = (await d.getDiagnosticsReport()).entries;
  expect(entry.kind).toBe("error");
  expect(entry.message).toContain("Sync failed");
  expect(entry.message).toContain("offline");
});

it("global handler records non-fatal errors and calls the previous handler right away", async () => {
  const d = load();
  d.installDiagnostics();
  const err = new Error("soft boom");
  installedHandler!(err, false);
  expect(previousHandler).toHaveBeenCalledWith(err, false);
  const [entry] = (await d.getDiagnosticsReport()).entries;
  expect(entry).toMatchObject({ kind: "error", message: "soft boom" });
});

it("saves a fatal error before handing over to the crash handler", async () => {
  const d = load();
  d.installDiagnostics();
  const err = new Error("crash");
  let storedAtCrash: string | null = null;
  const handedOver = new Promise<void>((resolve) => {
    previousHandler.mockImplementation(() => {
      AsyncStorage.getItem(STORAGE_KEY).then((v) => { storedAtCrash = v; resolve(); });
    });
  });
  installedHandler!(err, true);
  expect(previousHandler).not.toHaveBeenCalled();
  await handedOver;
  expect(previousHandler).toHaveBeenCalledWith(err, true);
  expect(JSON.parse(storedAtCrash!).at(-1)).toMatchObject({ kind: "fatal", message: "crash" });
});

it("hands over to the crash handler even if saving hangs", async () => {
  const d = load();
  d.installDiagnostics();
  await d.getDiagnosticsReport();
  jest.useFakeTimers();
  (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
  installedHandler!(new Error("crash"), true);
  await jest.advanceTimersByTimeAsync(1000);
  jest.useRealTimers();
  expect(previousHandler).toHaveBeenCalled();
});

it("console.error never throws, whatever it is given", () => {
  const original = console.error as jest.Mock;
  const d = load();
  d.installDiagnostics();
  const hostile = Object.create(null);
  hostile.self = hostile;
  expect(() => console.error(hostile)).not.toThrow();
  expect(original).toHaveBeenCalledWith(hostile);
});

it("records failed requests without their query string", async () => {
  const d = load();
  d.recordRequestFailure("GET", "/api/prayer-times/timings", 503);
  d.recordRequestFailure("POST", "/api/feedback", "offline");
  const { entries } = await d.getDiagnosticsReport();
  expect(entries.map((e) => [e.kind, e.message])).toEqual([
    ["network", "GET /api/prayer-times/timings: 503"],
    ["network", "POST /api/feedback: offline"],
  ]);
});

it("restores stored entries on install", async () => {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      { at: 1, kind: "fatal", message: "old crash" },
      { at: 2, kind: "screen", message: "/Quran" },
    ]),
  );
  const d = load();
  d.installDiagnostics();
  d.recordError("error", new Error("new"));
  const { entries } = await d.getDiagnosticsReport();
  expect(entries.map((e) => e.message)).toEqual(["old crash", "/Quran", "new"]);
});

it("handles non-Error values", async () => {
  const d = load();
  d.recordError("error", "plain string");
  d.recordError("error", { code: 7 });
  d.recordError("error", undefined);
  const { entries } = await d.getDiagnosticsReport();
  expect(entries.map((e) => e.message)).toEqual(["plain string", '{"code":7}', "undefined"]);
});

it("reports device context", async () => {
  const d = load();
  const report = await d.getDiagnosticsReport();
  expect(report.context).toEqual({
    os: "iOS",
    osVersion: "18.1",
    deviceModel: "iPhone 14 Pro",
    updateId: "upd-1",
    timeZone: expect.any(String),
    locale: expect.any(String),
  });
});
