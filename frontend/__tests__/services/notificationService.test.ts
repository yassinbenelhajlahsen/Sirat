import type { PrayerKey } from "@/utils/notifications/constants";

type NotificationServiceSetup = {
  NotificationService: {
    init: () => Promise<void>;
    rescheduleAll: (reason: "init" | "midnight" | "notif-prefs-changed" | "settings-changed" | "app-foreground" | "prayer-log-changed") => Promise<void>;
    cancelAll: () => Promise<void>;
  };
  lifecycleCallbackRef: { cb?: (reason: any) => void };
  mocks: {
    setNotificationHandler: jest.Mock;
    getPrayerTimesToday: jest.Mock;
    canUseOSLocation: jest.Mock;
    deriveEffectiveSettings: jest.Mock;
    resolveCityDisplay: jest.Mock;
    initNotificationLifecycle: jest.Mock;
    configureAndroidNotificationChannel: jest.Mock;
    ensureNotificationPermissions: jest.Mock;
    cancelPreviouslyScheduled: jest.Mock;
    scheduleForHorizon: jest.Mock;
    yyyymmdd: jest.Mock;
    readDayFingerprint: jest.Mock;
    readMasterEnabled: jest.Mock;
    readPrefs: jest.Mock;
    readPrayerSettings: jest.Mock;
    readSoundMode: jest.Mock;
    readWindowMap: jest.Mock;
    readWindowOffset: jest.Mock;
    writeDayFingerprint: jest.Mock;
  };
};

const defaultPrefs: Record<PrayerKey, boolean> = {
  Fajr: true,
  Sunrise: true,
  Dhuhr: true,
  Asr: true,
  Maghrib: true,
  Isha: true,
};

async function loadNotificationService(overrides?:
  Partial<NotificationServiceSetup["mocks"]>): Promise<NotificationServiceSetup> {
  jest.resetModules();

  const lifecycleCallbackRef: { cb?: (reason: any) => void } = {};

  const mocks: NotificationServiceSetup["mocks"] = {
    setNotificationHandler: jest.fn(),
    getPrayerTimesToday: jest.fn(async () => [{ label: "Fajr", time: "05:00 AM" }]),
    canUseOSLocation: jest.fn(async () => true),
    deriveEffectiveSettings: jest.fn((settings) => settings),
    resolveCityDisplay: jest.fn(async () => "Chicago"),
    initNotificationLifecycle: jest.fn((cb) => {
      lifecycleCallbackRef.cb = cb;
    }),
    configureAndroidNotificationChannel: jest.fn(async () => {}),
    ensureNotificationPermissions: jest.fn(async () => true),
    cancelPreviouslyScheduled: jest.fn(async () => {}),
    scheduleForHorizon: jest.fn(async () => {}),
    yyyymmdd: jest.fn(() => "2026-02-25"),
    readDayFingerprint: jest.fn(async () => ""),
    readMasterEnabled: jest.fn(async () => true),
    readPrefs: jest.fn(async () => defaultPrefs),
    readPrayerSettings: jest.fn(async () => ({ useLocation: true, method: 2, city: null })),
    readSoundMode: jest.fn(async () => "default"),
    readWindowMap: jest.fn(async () => ({
      Fajr: false,
      Dhuhr: true,
      Asr: false,
      Maghrib: false,
    })),
    readWindowOffset: jest.fn(async () => 15),
    writeDayFingerprint: jest.fn(async () => {}),
  };

  Object.assign(mocks, overrides ?? {});

  jest.doMock("expo-notifications", () => ({
    setNotificationHandler: mocks.setNotificationHandler,
  }));

  jest.doMock("@/services/prayerTimes", () => ({
    getPrayerTimesToday: mocks.getPrayerTimesToday,
  }));

  jest.doMock("@/services/notifications/cityResolver", () => ({
    canUseOSLocation: mocks.canUseOSLocation,
    deriveEffectiveSettings: mocks.deriveEffectiveSettings,
    resolveCityDisplay: mocks.resolveCityDisplay,
  }));

  jest.doMock("@/services/notifications/lifecycle", () => ({
    initNotificationLifecycle: mocks.initNotificationLifecycle,
  }));

  jest.doMock("@/services/notifications/permissions", () => ({
    configureAndroidNotificationChannel: mocks.configureAndroidNotificationChannel,
    ensureNotificationPermissions: mocks.ensureNotificationPermissions,
  }));

  jest.doMock("@/services/notifications/scheduler", () => ({
    cancelPreviouslyScheduled: mocks.cancelPreviouslyScheduled,
    scheduleForHorizon: mocks.scheduleForHorizon,
    yyyymmdd: mocks.yyyymmdd,
  }));

  jest.doMock("@/services/notifications/storage", () => ({
    readDayFingerprint: mocks.readDayFingerprint,
    readMasterEnabled: mocks.readMasterEnabled,
    readPrefs: mocks.readPrefs,
    readPrayerSettings: mocks.readPrayerSettings,
    readSoundMode: mocks.readSoundMode,
    readWindowMap: mocks.readWindowMap,
    readWindowOffset: mocks.readWindowOffset,
    writeDayFingerprint: mocks.writeDayFingerprint,
  }));

  const mod = require("@/services/notificationService");

  return {
    NotificationService: mod.NotificationService,
    lifecycleCallbackRef,
    mocks,
  };
}

describe("NotificationService", () => {
  it("cancels schedules when permissions are denied", async () => {
    const { NotificationService, mocks } = await loadNotificationService({
      ensureNotificationPermissions: jest.fn(async () => false),
    });

    await NotificationService.rescheduleAll("init");

    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleForHorizon).not.toHaveBeenCalled();
  });

  it("cancels schedules when master toggle is disabled", async () => {
    const { NotificationService, mocks } = await loadNotificationService({
      readMasterEnabled: jest.fn(async () => false),
    });

    await NotificationService.rescheduleAll("init");

    expect(mocks.ensureNotificationPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleForHorizon).not.toHaveBeenCalled();
  });

  it("rebuilds schedule and writes fingerprint when state changes", async () => {
    const { NotificationService, mocks } = await loadNotificationService({
      readDayFingerprint: jest.fn(async () => "old-key"),
    });

    await NotificationService.rescheduleAll("init");

    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleForHorizon).toHaveBeenCalledTimes(1);
    expect(mocks.writeDayFingerprint).toHaveBeenCalledTimes(1);
    expect(mocks.writeDayFingerprint.mock.calls[0][0]).toContain("day_2026-02-25");
  });

  it("avoids heavy rebuild on app foreground when fingerprint is unchanged", async () => {
    const { NotificationService, mocks } = await loadNotificationService({
      readDayFingerprint: jest.fn(async () => "old-key"),
    });

    await NotificationService.rescheduleAll("init");
    const fingerprint = mocks.writeDayFingerprint.mock.calls[0][0];

    mocks.readDayFingerprint.mockResolvedValue(fingerprint);
    mocks.cancelPreviouslyScheduled.mockClear();
    mocks.scheduleForHorizon.mockClear();
    mocks.writeDayFingerprint.mockClear();

    await NotificationService.rescheduleAll("app-foreground");

    expect(mocks.cancelPreviouslyScheduled).not.toHaveBeenCalled();
    expect(mocks.scheduleForHorizon).toHaveBeenCalledTimes(1);
    expect(mocks.writeDayFingerprint).not.toHaveBeenCalled();
  });

  it("forces rebuild on settings change even with unchanged fingerprint", async () => {
    const { NotificationService, mocks } = await loadNotificationService({
      readDayFingerprint: jest.fn(async () => "old-key"),
    });

    await NotificationService.rescheduleAll("init");
    const fingerprint = mocks.writeDayFingerprint.mock.calls[0][0];

    mocks.readDayFingerprint.mockResolvedValue(fingerprint);
    mocks.cancelPreviouslyScheduled.mockClear();
    mocks.scheduleForHorizon.mockClear();
    mocks.writeDayFingerprint.mockClear();

    await NotificationService.rescheduleAll("settings-changed");

    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleForHorizon).toHaveBeenCalledTimes(1);
    expect(mocks.writeDayFingerprint).toHaveBeenCalledTimes(1);
  });

  it("forces rebuild on prayer-log-changed even with unchanged fingerprint", async () => {
    const { NotificationService, mocks } = await loadNotificationService({
      readDayFingerprint: jest.fn(async () => "old-key"),
    });

    await NotificationService.rescheduleAll("init");
    const fingerprint = mocks.writeDayFingerprint.mock.calls[0][0];

    mocks.readDayFingerprint.mockResolvedValue(fingerprint);
    mocks.cancelPreviouslyScheduled.mockClear();
    mocks.scheduleForHorizon.mockClear();
    mocks.writeDayFingerprint.mockClear();

    await NotificationService.rescheduleAll("prayer-log-changed");

    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleForHorizon).toHaveBeenCalledTimes(1);
    expect(mocks.writeDayFingerprint).toHaveBeenCalledTimes(1);
  });

  it("passes window preferences and offset through to scheduleForHorizon", async () => {
    const { NotificationService, mocks } = await loadNotificationService({
      readDayFingerprint: jest.fn(async () => "old-key"),
    });

    await NotificationService.rescheduleAll("init");

    expect(mocks.scheduleForHorizon).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleForHorizon.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
        windowOffset: 15,
      }),
    );
  });

  it("initializes once and wires lifecycle callback", async () => {
    const { NotificationService, lifecycleCallbackRef, mocks } = await loadNotificationService({
      readMasterEnabled: jest.fn(async () => false),
    });

    await NotificationService.init();
    await NotificationService.init();

    expect(mocks.configureAndroidNotificationChannel).toHaveBeenCalledTimes(1);
    expect(mocks.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(mocks.initNotificationLifecycle).toHaveBeenCalledTimes(1);

    expect(typeof lifecycleCallbackRef.cb).toBe("function");
    await lifecycleCallbackRef.cb?.("app-foreground");
    expect(mocks.cancelPreviouslyScheduled).toHaveBeenCalled();
  });
});
