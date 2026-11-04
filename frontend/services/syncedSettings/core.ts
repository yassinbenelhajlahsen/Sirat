import AsyncStorage from "@react-native-async-storage/async-storage";

import { bumpStamp } from "@/services/sync/settingsMeta";

export type ChangeSource = "local" | "remote";

type Encoding = "json" | "string" | "bool01";

export type SettingDeclaration<T> = {
  /** Stable key inside the sync envelope. Never rename without a migration. */
  envelopeKey: string;
  /** AsyncStorage key. Ignored when `io` is given. */
  storageKey: string;
  encoding: Encoding;
  defaultValue: T;
  /** Validate and coerce a stored or remote value. `undefined` rejects it. */
  normalize(input: unknown): T | undefined;
  /** shortcut: only for values that span several storage keys; fold into one key if a migration ever happens. */
  io?: { load(): Promise<unknown>; save(value: T): Promise<void> };
};

export type SyncedSetting<T> = {
  readonly key: string;
  /** Current persisted value, or the default. */
  get(): Promise<T>;
  /** Last value this process saw, for first-frame renders. */
  peek(): T;
  /** A user edit: persist, stamp for sync, notify. */
  set(value: T): Promise<T>;
  /** A value merged in from another device: persist and notify, never stamp. */
  applyRemote(value: unknown): Promise<boolean>;
  subscribe(listener: (value: T, source: ChangeSource) => void): () => void;
};

function decode(raw: string | null, encoding: Encoding): unknown {
  if (raw == null) return undefined;
  if (encoding === "string") return raw;
  if (encoding === "bool01") return raw === "1" ? true : raw === "0" ? false : undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function encode(value: unknown, encoding: Encoding): string {
  if (encoding === "string") return String(value);
  if (encoding === "bool01") return value ? "1" : "0";
  return JSON.stringify(value);
}

const registry: SyncedSetting<unknown>[] = [];
const globalListeners = new Set<(key: string, source: ChangeSource) => void>();

/** Every declared setting; the sync envelope is generated from this. */
export function allSyncedSettings(): readonly SyncedSetting<unknown>[] {
  return registry;
}

/** Fires for any setting change, after the per-setting listeners. */
export function subscribeToAllSettings(
  listener: (key: string, source: ChangeSource) => void,
): () => void {
  globalListeners.add(listener);
  return () => globalListeners.delete(listener);
}

export function defineSetting<T>(decl: SettingDeclaration<T>): SyncedSetting<T> {
  const listeners = new Set<(value: T, source: ChangeSource) => void>();
  let last = decl.defaultValue;

  async function load(): Promise<T> {
    try {
      const stored = decl.io
        ? await decl.io.load()
        : decode(await AsyncStorage.getItem(decl.storageKey), decl.encoding);
      const normalized = decl.normalize(stored);
      last = normalized === undefined ? decl.defaultValue : normalized;
    } catch {
      last = decl.defaultValue;
    }
    return last;
  }

  async function persist(value: T): Promise<void> {
    try {
      if (decl.io) await decl.io.save(value);
      else await AsyncStorage.setItem(decl.storageKey, encode(value, decl.encoding));
    } catch {
      // Keep the in-memory value even if persistence fails.
    }
    last = value;
  }

  // Must stay synchronous: the sync engine relies on `source === "remote"` being visible to listeners.
  function emit(value: T, source: ChangeSource): void {
    for (const l of [...listeners]) l(value, source);
    for (const l of [...globalListeners]) l(decl.envelopeKey, source);
  }

  const setting: SyncedSetting<T> = {
    key: decl.envelopeKey,
    get: load,
    peek: () => last,
    async set(value) {
      const next = decl.normalize(value);
      if (next === undefined) return load();
      await persist(next);
      await bumpStamp(decl.envelopeKey);
      emit(next, "local");
      return next;
    },
    async applyRemote(value) {
      const next = decl.normalize(value);
      if (next === undefined) return false;
      await persist(next);
      emit(next, "remote");
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  registry.push(setting as SyncedSetting<unknown>);
  return setting;
}
