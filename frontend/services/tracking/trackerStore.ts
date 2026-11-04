import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

/** What changed, so a listener can skip days it is not showing. Absent for stores with no per-day data. */
export type TrackerChange = { dateKey?: string | null };

export type TrackerStore<T> = {
  /** Cached after the first read; concurrent first reads share one load. */
  get(): Promise<T>;
  /** Whatever is cached now, or empty before the first read. */
  peek(): T;
  /** Persist, update the cache and notify. A failed write keeps the in-memory value. */
  save(next: T, change?: TrackerChange): Promise<void>;
  subscribe(listener: (change: TrackerChange) => void): () => void;
};

export function createTrackerStore<T>(opts: {
  storageKey: string;
  event: string;
  empty: () => T;
  /** Shape-check parsed storage; return `empty()` for anything unusable. */
  parse: (raw: unknown) => T;
}): TrackerStore<T> {
  let cache: T | null = null;
  let loadPromise: Promise<T> | null = null;

  return {
    get() {
      if (cache !== null) return Promise.resolve(cache);
      if (!loadPromise) {
        loadPromise = (async () => {
          try {
            const raw = await AsyncStorage.getItem(opts.storageKey);
            cache = raw ? opts.parse(JSON.parse(raw)) : opts.empty();
          } catch {
            cache = opts.empty();
          } finally {
            loadPromise = null;
          }
          return cache as T;
        })();
      }
      return loadPromise;
    },
    peek: () => cache ?? opts.empty(),
    async save(next, change) {
      cache = next;
      try {
        await AsyncStorage.setItem(opts.storageKey, JSON.stringify(next));
      } catch {
        // keep in-memory state even if persistence fails
      }
      try {
        if (change === undefined) DeviceEventEmitter.emit(opts.event);
        else DeviceEventEmitter.emit(opts.event, change);
      } catch {
        // best-effort
      }
    },
    subscribe(listener) {
      const sub = DeviceEventEmitter.addListener(opts.event, (change?: TrackerChange) => listener(change ?? {}));
      return () => sub.remove();
    },
  };
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
