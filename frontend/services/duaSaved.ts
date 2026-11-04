import { duaSavedSetting } from "@/services/syncedSettings";

/** Saved dua ids, newest first. Ids missing from the dataset are skipped at display time. */
export const getSavedDuaIds = () => duaSavedSetting.get();

/** Returns whether the dua is saved after the toggle. */
export async function toggleSavedDua(id: number): Promise<boolean> {
  const existing = await duaSavedSetting.get();
  const saved = !existing.includes(id);
  await duaSavedSetting.set(saved ? [id, ...existing] : existing.filter((x) => x !== id));
  return saved;
}
