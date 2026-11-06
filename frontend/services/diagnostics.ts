import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Updates from "expo-updates";

// Device-local error log attached to bug reports only. Never synced, never shown.

export type DiagnosticEntry = {
  at: number;
  kind: "error" | "fatal" | "rejection" | "render" | "screen" | "network";
  message: string;
  stack?: string;
};

export type DiagnosticsReport = {
  context: {
    os: string;
    osVersion: string;
    deviceModel: string;
    updateId: string | null;
    timeZone: string;
    locale: string;
  };
  entries: DiagnosticEntry[];
};

const STORAGE_KEY = "diagnostics_log_v1";
const MAX_ENTRIES = 50;
const MAX_SCREENS = 10;
const MAX_MESSAGE = 500;
const MAX_STACK = 2000;
const PERSIST_DELAY_MS = 1000;
const FLUSH_CAP_MS = 300;

let entries: DiagnosticEntry[] = [];
let installed = false;
let hydration: Promise<void> = Promise.resolve();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function describe(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function trim(list: DiagnosticEntry[]): DiagnosticEntry[] {
  let extraScreens = list.filter((e) => e.kind === "screen").length - MAX_SCREENS;
  const kept = list.filter((e) => !(e.kind === "screen" && extraScreens-- > 0));
  return kept.slice(-MAX_ENTRIES);
}

function persistNow(): Promise<void> {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  // Wait for hydration so a crash during startup can't overwrite the stored history.
  return hydration
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)))
    .catch(() => {});
}

/** Saves the log now, but never holds a crash up for longer than the cap. */
export function flushDiagnostics(): Promise<void> {
  return Promise.race([
    persistNow(),
    new Promise<void>((resolve) => setTimeout(resolve, FLUSH_CAP_MS)),
  ]);
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => void persistNow(), PERSIST_DELAY_MS);
}

function push(entry: DiagnosticEntry) {
  entries = trim([...entries, entry]);
  schedulePersist();
}

export function recordError(kind: DiagnosticEntry["kind"], error: unknown): void {
  const stack = error instanceof Error && error.stack ? error.stack.slice(0, MAX_STACK) : undefined;
  push({ at: Date.now(), kind, message: describe(error).slice(0, MAX_MESSAGE), ...(stack ? { stack } : {}) });
}

export function recordScreen(pathname: string): void {
  push({ at: Date.now(), kind: "screen", message: pathname.slice(0, MAX_MESSAGE) });
}

// Path only: query strings can carry the user's coordinates.
export function recordRequestFailure(method: string, path: string, status: number | "offline"): void {
  push({ at: Date.now(), kind: "network", message: `${method} ${path}: ${status}`.slice(0, MAX_MESSAGE) });
}

function isEntry(value: unknown): value is DiagnosticEntry {
  const v = value as DiagnosticEntry;
  return typeof v === "object" && v !== null && typeof v.kind === "string" && typeof v.message === "string";
}

export function installDiagnostics(): void {
  if (installed) return;
  installed = true;

  hydration = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const stored: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(stored)) entries = trim([...stored.filter(isEntry), ...entries]);
    })
    .catch(() => {});

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    // Logging must keep working whatever it is handed, so recording can't be allowed to throw.
    try {
      const firstError = args.find((a): a is Error => a instanceof Error);
      push({
        at: Date.now(),
        kind: "error",
        message: args.map(describe).join(" ").slice(0, MAX_MESSAGE),
        ...(firstError?.stack ? { stack: firstError.stack.slice(0, MAX_STACK) } : {}),
      });
    } catch {}
    originalConsoleError(...args);
  };

  const errorUtils = (global as any).ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      recordError(isFatal ? "fatal" : "error", error);
      // The previous handler ends the process on a fatal, so the save has to land first.
      if (isFatal) void flushDiagnostics().finally(() => previous?.(error, isFatal));
      else previous?.(error, isFatal);
    });
  }

  // React Native only tracks unhandled rejections in dev; production needs its own tracker.
  if (!__DEV__) {
    (global as any).HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id: number, error: unknown) => recordError("rejection", error),
    });
  }
}

export async function getDiagnosticsReport(): Promise<DiagnosticsReport> {
  await hydration;
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  return {
    context: {
      os: Device.osName ?? "unknown",
      osVersion: Device.osVersion ?? "unknown",
      deviceModel: Device.modelName ?? Device.modelId ?? "unknown",
      updateId: Updates.updateId ?? null,
      timeZone: resolved.timeZone,
      locale: resolved.locale,
    },
    entries: [...entries],
  };
}
