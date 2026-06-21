import type { DomainAdapter } from "../types";
import type { SettingsEnvelope } from "@/services/tracking/types";
import { SETTINGS_REGISTRY } from "../settingsRegistry";
import { getSettingsMeta, setStamp } from "../settingsMeta";
import { mergeSettings } from "@/services/tracking/merge";

async function readEnvelope(): Promise<SettingsEnvelope> {
  const meta = await getSettingsMeta();
  const env: SettingsEnvelope = {};
  for (const entry of SETTINGS_REGISTRY) {
    env[entry.key] = { value: await entry.read(), updatedAt: meta[entry.key] ?? 0 };
  }
  return env;
}

export const settingsAdapter: DomainAdapter<SettingsEnvelope> = {
  read: readEnvelope,
  async applyMerged(server) {
    const local = await readEnvelope();
    const merged = mergeSettings(local, server);
    const meta = await getSettingsMeta();
    for (const entry of SETTINGS_REGISTRY) {
      const cell = merged[entry.key];
      if (!cell) continue;
      if (cell.updatedAt > (meta[entry.key] ?? 0)) {
        await entry.applyValue(cell.value);
        await setStamp(entry.key, cell.updatedAt);
      }
    }
  },
};
