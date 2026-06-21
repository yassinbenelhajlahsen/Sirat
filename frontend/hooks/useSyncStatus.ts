import { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { SYNC_STATUS_EVENT, type SyncStatus, getLastSyncedAt } from "@/services/sync/syncEngine";

export function useSyncStatus(): { status: SyncStatus; lastSyncedAt: number | null } {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    void getLastSyncedAt().then((v) => { if (mounted) setLastSyncedAt(v); });
    const sub = DeviceEventEmitter.addListener(
      SYNC_STATUS_EVENT,
      (p: { status: SyncStatus; lastSyncedAt?: number | null }) => {
        setStatus(p.status);
        if (p.lastSyncedAt != null) setLastSyncedAt(p.lastSyncedAt);
      },
    );
    return () => { mounted = false; sub.remove(); };
  }, []);

  return { status, lastSyncedAt };
}
