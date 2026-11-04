type LifecycleSetup = {
  initNotificationLifecycle: (
    onReschedule: (reason: string) => void,
  ) => void;
  eventCallbacks: Record<string, () => void>;
  appStateRef: { cb: ((state: string) => void) | null };
  addListenerMock: jest.Mock;
  addAppStateListenerMock: jest.Mock;
  msUntilNextLocalMidnightPlusMock: jest.Mock;
  settings: typeof import("@/services/syncedSettings");
  storage: typeof import("@/services/notifications/storage");
  hijri: typeof import("@/utils/hijriDate");
};

function loadLifecycle(): LifecycleSetup {
  jest.resetModules();

  const eventCallbacks: Record<string, () => void> = {};
  const appStateRef: { cb: ((state: string) => void) | null } = { cb: null };

  const addListenerMock = jest.fn((event: string, cb: () => void) => {
    eventCallbacks[event] = cb;
    return { remove: jest.fn() };
  });

  const addAppStateListenerMock = jest.fn((event: string, cb: (state: string) => void) => {
    if (event === "change") {
      appStateRef.cb = cb;
    }
    return { remove: jest.fn() };
  });

  const msUntilNextLocalMidnightPlusMock = jest.fn(() => 1000);

  jest.doMock("react-native", () => ({
    Platform: {
      OS: "ios",
    },
    AppState: {
      addEventListener: addAppStateListenerMock,
    },
    DeviceEventEmitter: {
      addListener: addListenerMock,
    },
  }));

  jest.doMock("@/services/notifications/scheduler", () => ({
    msUntilNextLocalMidnightPlus: msUntilNextLocalMidnightPlusMock,
  }));

  const mod = require("@/services/notifications/lifecycle");

  return {
    initNotificationLifecycle: mod.initNotificationLifecycle,
    eventCallbacks,
    appStateRef,
    addListenerMock,
    addAppStateListenerMock,
    msUntilNextLocalMidnightPlusMock,
    settings: require("@/services/syncedSettings") as typeof import("@/services/syncedSettings"),
    storage: require("@/services/notifications/storage") as typeof import("@/services/notifications/storage"),
    hijri: require("@/utils/hijriDate") as typeof import("@/utils/hijriDate"),
  };
}

describe("notifications/lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("attaches listeners once and asks for a reschedule with the right reason", async () => {
    const setup = loadLifecycle();
    const onReschedule = jest.fn();

    setup.initNotificationLifecycle(onReschedule);
    setup.initNotificationLifecycle(onReschedule);

    expect(setup.addListenerMock).toHaveBeenCalledTimes(1);
    expect(setup.addAppStateListenerMock).toHaveBeenCalledTimes(1);

    setup.appStateRef.cb?.("active");
    expect(onReschedule).toHaveBeenLastCalledWith("app-foreground");

    await setup.settings.prayerSettingsSetting.set({ useLocation: true, method: 2, city: null });
    expect(onReschedule).toHaveBeenLastCalledWith("settings-changed");

    setup.eventCallbacks.PRAYER_LOG_UPDATED();
    expect(onReschedule).toHaveBeenLastCalledWith("prayer-log-changed");
  });

  it.each([
    ["Friday reminder", (s: LifecycleSetup) => s.settings.notifFridaySetting.applyRemote(false)],
    ["Ramadan mode", (s: LifecycleSetup) => s.settings.ramadanModeSetting.set(false)],
    ["sound mode", (s: LifecycleSetup) => s.settings.notifSoundModeSetting.set("adhan")],
    ["prayer toggles", (s: LifecycleSetup) => s.settings.notifPrefsSetting.set({ ...s.settings.notifPrefsSetting.peek(), Fajr: false })],
    ["window offset", (s: LifecycleSetup) => s.settings.notifWindowOffsetSetting.set(30)],
    ["window prayers", (s: LifecycleSetup) => s.settings.notifWindowMapSetting.set({ Fajr: true, Dhuhr: true, Asr: true, Maghrib: true })],
    ["the master switch", (s: LifecycleSetup) => s.storage.writeMasterEnabled(true)],
    ["Pretend it's Ramadan", async (s: LifecycleSetup) => s.hijri.setPretendRamadan(true)],
  ])("asks for a reschedule on its own when %s changes", async (_name, change) => {
    const setup = loadLifecycle();
    const onReschedule = jest.fn();
    setup.initNotificationLifecycle(onReschedule);

    await change(setup);

    expect(onReschedule).toHaveBeenCalledWith("notif-prefs-changed");
  });

  it("schedules midnight rollover and re-schedules after firing", async () => {
    const setup = loadLifecycle();
    const onReschedule = jest.fn();

    setup.initNotificationLifecycle(onReschedule);

    expect(setup.msUntilNextLocalMidnightPlusMock).toHaveBeenCalled();
    expect(onReschedule).not.toHaveBeenCalledWith("midnight");

    jest.advanceTimersByTime(1000);

    expect(onReschedule).toHaveBeenCalledWith("midnight");
    const firstMidnightCount = onReschedule.mock.calls.filter(
      ([reason]) => reason === "midnight",
    ).length;
    expect(firstMidnightCount).toBe(1);

    jest.advanceTimersByTime(1000);

    const secondMidnightCount = onReschedule.mock.calls.filter(
      ([reason]) => reason === "midnight",
    ).length;
    expect(secondMidnightCount).toBe(2);
  });
});
