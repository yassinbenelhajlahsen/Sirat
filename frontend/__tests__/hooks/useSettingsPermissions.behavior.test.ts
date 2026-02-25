import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert, AppState, Linking } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

jest.mock("expo-location", () => ({
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
}));

import { useSettingsPermissions } from "@/hooks/useSettingsPermissions";

const mockLocation = Location as jest.Mocked<typeof Location>;
const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

let appStateHandler:
  | ((state: "active" | "background" | "inactive") => Promise<void> | void)
  | null = null;
const mockAppStateRemove = jest.fn();

describe("hooks/useSettingsPermissions behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateRemove.mockReset();
    appStateHandler = null;

    mockLocation.hasServicesEnabledAsync.mockResolvedValue(true as never);
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: true,
    } as never);

    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation(
        ((event: string, cb: typeof appStateHandler) => {
          if (event === "change") appStateHandler = cb;
          return { remove: mockAppStateRemove } as any;
        }) as any,
      );
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("bootstraps permission/notif status and disables stale useLocation preference", async () => {
    const setUseLocation = jest.fn();
    mockLocation.hasServicesEnabledAsync.mockResolvedValue(false as never);
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: false,
    } as never);

    const { result } = renderHook(() =>
      useSettingsPermissions({
        useLocation: true,
        setUseLocation,
      }),
    );

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("granted");
      expect(result.current.notifStatus).toBe("denied");
    });

    expect(setUseLocation).toHaveBeenCalledWith(false);
  });

  it("refreshes statuses when app state returns to active", async () => {
    const setUseLocation = jest.fn();
    mockLocation.hasServicesEnabledAsync
      .mockResolvedValueOnce(true as never)
      .mockResolvedValueOnce(false as never);
    mockLocation.getForegroundPermissionsAsync
      .mockResolvedValueOnce({ status: "granted" } as never)
      .mockResolvedValueOnce({ status: "denied" } as never);
    mockNotifications.getPermissionsAsync
      .mockResolvedValueOnce({ granted: true } as never)
      .mockResolvedValueOnce({ granted: false } as never);

    const { result } = renderHook(() =>
      useSettingsPermissions({
        useLocation: true,
        setUseLocation,
      }),
    );

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("granted");
      expect(result.current.notifStatus).toBe("granted");
    });

    await act(async () => {
      await appStateHandler?.("background");
    });
    expect(mockLocation.hasServicesEnabledAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      await appStateHandler?.("active");
    });

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("denied");
      expect(result.current.notifStatus).toBe("denied");
    });
    expect(setUseLocation).toHaveBeenCalledWith(false);
  });

  it("turns off location immediately when toggle is disabled", async () => {
    const setUseLocation = jest.fn();

    const { result } = renderHook(() =>
      useSettingsPermissions({
        useLocation: false,
        setUseLocation,
      }),
    );

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("granted");
    });

    await act(async () => {
      await result.current.handleLocationToggle(false);
    });

    expect(setUseLocation).toHaveBeenCalledWith(false);
    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("opens settings prompt when user enables toggle but location services are off", async () => {
    const setUseLocation = jest.fn();
    mockLocation.hasServicesEnabledAsync
      .mockResolvedValueOnce(true as never)
      .mockResolvedValueOnce(false as never);

    const { result } = renderHook(() =>
      useSettingsPermissions({
        useLocation: false,
        setUseLocation,
      }),
    );

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("granted");
    });

    await act(async () => {
      await result.current.handleLocationToggle(true);
    });

    const locationOffCall = (Alert.alert as jest.Mock).mock.calls.find(
      (call) => call[0] === "Location is off",
    );
    expect(locationOffCall).toBeTruthy();

    const buttons = locationOffCall?.[2] as Array<{ onPress?: () => void }>;
    buttons[0]?.onPress?.();

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(setUseLocation).toHaveBeenCalledWith(false);
  });

  it("requests permission and enables location when permission is granted", async () => {
    const setUseLocation = jest.fn();
    mockLocation.getForegroundPermissionsAsync
      .mockResolvedValueOnce({ status: "granted" } as never)
      .mockResolvedValueOnce({ status: "undetermined" } as never);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);

    const { result } = renderHook(() =>
      useSettingsPermissions({
        useLocation: false,
        setUseLocation,
      }),
    );

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("granted");
    });

    await act(async () => {
      await result.current.handleLocationToggle(true);
    });

    expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(setUseLocation).toHaveBeenCalledWith(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("shows permission-needed prompt when request still resolves to denied", async () => {
    const setUseLocation = jest.fn();
    mockLocation.getForegroundPermissionsAsync
      .mockResolvedValueOnce({ status: "granted" } as never)
      .mockResolvedValueOnce({ status: "denied" } as never);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    } as never);

    const { result } = renderHook(() =>
      useSettingsPermissions({
        useLocation: false,
        setUseLocation,
      }),
    );

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe("granted");
    });

    await act(async () => {
      await result.current.handleLocationToggle(true);
    });

    const permissionCall = (Alert.alert as jest.Mock).mock.calls.find(
      (call) => call[0] === "Permission needed",
    );
    expect(permissionCall).toBeTruthy();
    expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(setUseLocation).toHaveBeenCalledWith(false);
  });
});
