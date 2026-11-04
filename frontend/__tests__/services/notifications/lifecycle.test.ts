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

  jest.doMock("@/services/tracking/prayerLog", () => ({
    PRAYER_LOG_UPDATED_EVENT: "PRAYER_LOG_UPDATED",
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
  };
}

describe("notifications/lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("attaches listeners once and emits expected reschedule reasons", async () => {
    const setup = loadLifecycle();
    const onReschedule = jest.fn();

    setup.initNotificationLifecycle(onReschedule);

    expect(setup.addListenerMock).toHaveBeenCalledTimes(2);
    expect(setup.addAppStateListenerMock).toHaveBeenCalledTimes(1);

    setup.eventCallbacks.NOTIF_PREFS_UPDATED();
    setup.appStateRef.cb?.("active");
    await setup.settings.prayerSettingsSetting.set({ useLocation: true, method: 2, city: null });

    expect(onReschedule).toHaveBeenCalledWith("notif-prefs-changed");
    expect(onReschedule).toHaveBeenCalledWith("settings-changed");
    expect(onReschedule).toHaveBeenCalledWith("app-foreground");

    onReschedule.mockClear();
    await setup.settings.notifFridaySetting.applyRemote(false);
    expect(onReschedule).toHaveBeenCalledWith("notif-prefs-changed");

    setup.initNotificationLifecycle(onReschedule);
    expect(setup.addListenerMock).toHaveBeenCalledTimes(2);
    expect(setup.addAppStateListenerMock).toHaveBeenCalledTimes(1);
  });

  it("invokes onReschedule with 'prayer-log-changed' when PRAYER_LOG_UPDATED_EVENT is emitted", async () => {
    const setup = loadLifecycle();
    const onReschedule = jest.fn();

    setup.initNotificationLifecycle(onReschedule);

    setup.eventCallbacks.PRAYER_LOG_UPDATED();

    expect(onReschedule).toHaveBeenCalledWith("prayer-log-changed");
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
