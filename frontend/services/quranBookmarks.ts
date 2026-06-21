import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

const BOOKMARKS_STORAGE_KEY = "quran:bookmarks";

export const QURAN_BOOKMARKS_UPDATED_EVENT = "QURAN_BOOKMARKS_UPDATED";

export type QuranBookmark = {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  ayahGlobalIndex: number;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type UpsertBookmarkInput = {
  id?: string;
  surahNumber: number;
  ayahNumber: number;
  ayahGlobalIndex: number;
  title: string;
};

type StoredBookmark = {
  id?: unknown;
  surahNumber?: unknown;
  ayahNumber?: unknown;
  ayahGlobalIndex?: unknown;
  title?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function generateBookmarkId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `bm-${timePart}-${randomPart}`;
}

function sanitizeBookmark(entry: StoredBookmark): QuranBookmark | null {
  const surahNumber = Number(entry.surahNumber);
  const ayahNumber = Number(entry.ayahNumber);
  const ayahGlobalIndex = Number(entry.ayahGlobalIndex);
  const createdAt = Number(entry.createdAt ?? Date.now());
  const updatedAt = Number(entry.updatedAt ?? createdAt);
  const title =
    typeof entry.title === "string" && entry.title.trim()
      ? entry.title.trim()
      : "";

  if (
    !Number.isFinite(surahNumber) ||
    !Number.isFinite(ayahNumber) ||
    !Number.isFinite(ayahGlobalIndex) ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(updatedAt) ||
    !title
  ) {
    return null;
  }

  return {
    id:
      typeof entry.id === "string" && entry.id.trim()
        ? entry.id.trim()
        : generateBookmarkId(),
    surahNumber,
    ayahNumber,
    ayahGlobalIndex,
    title,
    createdAt,
    updatedAt,
  };
}

async function persistBookmarks(bookmarks: QuranBookmark[]): Promise<void> {
  try {
    const serialized = JSON.stringify(bookmarks);
    await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, serialized);
  } catch {
    /**
     * Persisting bookmarks failed; ignore for now while keeping state in memory.
     */
  }
}

function sortBookmarks(bookmarks: QuranBookmark[]): QuranBookmark[] {
  return [...bookmarks].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getBookmarks(): Promise<QuranBookmark[]> {
  try {
    const stored = await AsyncStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const sanitized = parsed
      .map((entry) => sanitizeBookmark(entry as StoredBookmark))
      .filter((bookmark): bookmark is QuranBookmark => Boolean(bookmark));

    return sortBookmarks(sanitized);
  } catch {
    return [];
  }
}

export async function upsertBookmark(
  payload: UpsertBookmarkInput
): Promise<QuranBookmark[]> {
  const existing = await getBookmarks();
  const now = Date.now();
  const normalizedTitle = payload.title.trim();

  if (!normalizedTitle) {
    return existing;
  }

  let nextBookmarks = existing;
  const byIdIndex = payload.id
    ? existing.findIndex((bookmark) => bookmark.id === payload.id)
    : -1;

  let targetIndex = byIdIndex;
  if (targetIndex === -1) {
    targetIndex = existing.findIndex(
      (bookmark) =>
        bookmark.surahNumber === payload.surahNumber &&
        bookmark.ayahNumber === payload.ayahNumber
    );
  }

  if (targetIndex !== -1) {
    const updated: QuranBookmark = {
      ...existing[targetIndex],
      surahNumber: payload.surahNumber,
      ayahNumber: payload.ayahNumber,
      ayahGlobalIndex: payload.ayahGlobalIndex,
      title: normalizedTitle,
      updatedAt: now,
    };
    nextBookmarks = [
      ...existing.slice(0, targetIndex),
      updated,
      ...existing.slice(targetIndex + 1),
    ];
  } else {
    const newBookmark: QuranBookmark = {
      id: generateBookmarkId(),
      surahNumber: payload.surahNumber,
      ayahNumber: payload.ayahNumber,
      ayahGlobalIndex: payload.ayahGlobalIndex,
      title: normalizedTitle,
      createdAt: now,
      updatedAt: now,
    };
    nextBookmarks = [...existing, newBookmark];
  }

  const sorted = sortBookmarks(nextBookmarks);
  await persistBookmarks(sorted);
  DeviceEventEmitter.emit(QURAN_BOOKMARKS_UPDATED_EVENT);
  return sorted;
}

export async function deleteBookmark(
  bookmarkId: string
): Promise<QuranBookmark[]> {
  const existing = await getBookmarks();
  if (!bookmarkId || !bookmarkId.trim()) {
    return existing;
  }

  const next = existing.filter((bookmark) => bookmark.id !== bookmarkId);
  if (next.length === existing.length) {
    return existing;
  }

  await persistBookmarks(next);
  DeviceEventEmitter.emit(QURAN_BOOKMARKS_UPDATED_EVENT);
  return next;
}

export function getBookmarkKey(
  surahNumber: number,
  ayahNumber: number
): string {
  return `${surahNumber}:${ayahNumber}`;
}

export async function replaceBookmarks(list: QuranBookmark[]): Promise<QuranBookmark[]> {
  await AsyncStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(list));
  DeviceEventEmitter.emit(QURAN_BOOKMARKS_UPDATED_EVENT);
  return list;
}
