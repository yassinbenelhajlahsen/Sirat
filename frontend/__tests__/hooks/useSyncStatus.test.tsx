import { renderHook, act } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { SYNC_STATUS_EVENT } from "@/services/sync/syncEngine";

jest.mock("@/services/sync/syncEngine", () => ({
  SYNC_STATUS_EVENT: "SYNC_STATUS_UPDATED",
  getLastSyncedAt: jest.fn().mockResolvedValue(null),
}));

it("updates when a status event fires", () => {
  const { result } = renderHook(() => useSyncStatus());
  expect(result.current.status).toBe("idle");
  act(() => { DeviceEventEmitter.emit(SYNC_STATUS_EVENT, { status: "syncing" }); });
  expect(result.current.status).toBe("syncing");
  act(() => { DeviceEventEmitter.emit(SYNC_STATUS_EVENT, { status: "success", lastSyncedAt: 123 }); });
  expect(result.current.status).toBe("success");
  expect(result.current.lastSyncedAt).toBe(123);
});
