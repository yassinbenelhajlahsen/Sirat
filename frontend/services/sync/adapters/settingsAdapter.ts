import type { DomainAdapter } from "../types";
import type { SettingsEnvelope } from "@/services/tracking/types";
import { allSyncedSettings } from "@/services/syncedSettings";
import { getSettingsMeta, setStamp } from "../settingsMeta";
import { mergeSettings } from "@/services/tracking/merge";

async function readEnvelope(): Promise<SettingsEnvelope> {
  const meta = await getSettingsMeta();
  const env: SettingsEnvelope = {};
  for (const setting of allSyncedSettings()) {
    env[setting.key] = { value: await setting.get(), updatedAt: meta[setting.key] ?? 0 };
  }
  return env;
}

export const settingsAdapter: DomainAdapter<SettingsEnvelope> = {
  read: readEnvelope,
  async applyMerged(server) {
    const local = await readEnvelope();
    const merged = mergeSettings(local, server);
    const meta = await getSettingsMeta();
    for (const setting of allSyncedSettings()) {
      const cell = merged[setting.key];
      if (!cell) continue;
      if (cell.updatedAt > (meta[setting.key] ?? 0)) {
        await setting.applyRemote(cell.value);
        await setStamp(setting.key, cell.updatedAt);
      }
    }
  },
};
