import { generateBookmarkId, quranBookmarksSetting } from "@/services/syncedSettings";

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

export const getBookmarks = () => quranBookmarksSetting.get();

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

  return quranBookmarksSetting.set(nextBookmarks);
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

  return quranBookmarksSetting.set(next);
}

export function getBookmarkKey(
  surahNumber: number,
  ayahNumber: number
): string {
  return `${surahNumber}:${ayahNumber}`;
}
