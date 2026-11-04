type Reason = "init" | "midnight" | "notif-prefs-changed" | "settings-changed" | "app-foreground" | "prayer-log-changed";

async function load(overrides: Record<string, jest.Mock> = {}) {
  jest.resetModules();
  const lifecycleCallbackRef: { cb?: (reason: Reason) => void } = {};
  const mocks = {
    setNotificationHandler: jest.fn(),
    initNotificationLifecycle: jest.fn((cb) => {
      lifecycleCallbackRef.cb = cb;
    }),
    configureAndroidNotificationChannel: jest.fn(async () => {}),
    ensureNotificationPermissions: jest.fn(async () => true),
    readMasterEnabled: jest.fn(async () => true),
    cancelPreviouslyScheduled: jest.fn(async () => {}),
    readPlanInputs: jest.fn(async () => ({ plan: "inputs" })),
    applySchedule: jest.fn(async () => {}),
    ...overrides,
  };

  jest.doMock("expo-notifications", () => ({ setNotificationHandler: mocks.setNotificationHandler }));
  jest.doMock("@/services/notifications/lifecycle", () => ({ initNotificationLifecycle: mocks.initNotificationLifecycle }));
  jest.doMock("@/services/notifications/permissions", () => ({
    configureAndroidNotificationChannel: mocks.configureAndroidNotificationChannel,
    ensureNotificationPermissions: mocks.ensureNotificationPermissions,
  }));
  jest.doMock("@/services/notifications/scheduler", () => ({
    cancelPreviouslyScheduled: mocks.cancelPreviouslyScheduled,
    readPlanInputs: mocks.readPlanInputs,
    applySchedule: mocks.applySchedule,
  }));
  jest.doMock("@/services/notifications/storage", () => ({ readMasterEnabled: mocks.readMasterEnabled }));

  const { NotificationService } = require("@/services/notificationService");
  return { NotificationService, lifecycleCallbackRef, mocks };
}

describe("NotificationService", () => {
  it("cancels schedules when permissions are denied", async () => {
    const { NotificationService, mocks } = await load({ ensureNotificationPermissions: jest.fn(async () => false) });
    await NotificationService.rescheduleAll("init");
    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalledTimes(1);
    expect(mocks.applySchedule).not.toHaveBeenCalled();
  });

  it("cancels schedules when the master toggle is off", async () => {
    const { NotificationService, mocks } = await load({ readMasterEnabled: jest.fn(async () => false) });
    await NotificationService.rescheduleAll("init");
    expect(mocks.ensureNotificationPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalledTimes(1);
    expect(mocks.applySchedule).not.toHaveBeenCalled();
  });

  it("applies a schedule built from freshly read inputs when enabled", async () => {
    const { NotificationService, mocks } = await load();
    await NotificationService.rescheduleAll("init");
    expect(mocks.applySchedule).toHaveBeenCalledWith({ plan: "inputs" });
    expect(mocks.cancelPreviouslyScheduled).not.toHaveBeenCalled();
  });

  it("cancels everything if building the schedule fails", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { NotificationService, mocks } = await load({ readPlanInputs: jest.fn(async () => { throw new Error("offline"); }) });
    await NotificationService.rescheduleAll("init");
    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("requests during a run collapse into exactly one more run afterwards", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const applySchedule = jest.fn(async () => { if (applySchedule.mock.calls.length === 1) await gate; });
    const { NotificationService } = await load({ applySchedule });

    const first = NotificationService.rescheduleAll("init");
    await Promise.resolve();
    await NotificationService.rescheduleAll("settings-changed");
    await NotificationService.rescheduleAll("notif-prefs-changed");
    await NotificationService.rescheduleAll("prayer-log-changed");
    expect(applySchedule).toHaveBeenCalledTimes(1);

    release();
    await first;
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(applySchedule).toHaveBeenCalledTimes(2);
  });

  it("initializes once and wires the lifecycle callback", async () => {
    const { NotificationService, lifecycleCallbackRef, mocks } = await load({ readMasterEnabled: jest.fn(async () => false) });

    await NotificationService.init();
    await NotificationService.init();

    expect(mocks.configureAndroidNotificationChannel).toHaveBeenCalledTimes(1);
    expect(mocks.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(mocks.initNotificationLifecycle).toHaveBeenCalledTimes(1);

    mocks.cancelPreviouslyScheduled.mockClear();
    await lifecycleCallbackRef.cb?.("app-foreground");
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalled();
  });
});
