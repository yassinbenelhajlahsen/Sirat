import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN = "ExponentPushToken[abc]";
const DAY = 24 * 60 * 60 * 1000;

type Opts = {
  isDevice?: boolean;
  platform?: "ios" | "android";
  granted?: boolean;
  iosStatus?: number;
  token?: string;
  apiPost?: jest.Mock;
};

function load(opts: Opts = {}) {
  jest.resetModules();

  const listeners: ((state: string) => void)[] = [];
  const addEventListener = jest.fn((_event: string, cb: (state: string) => void) => {
    listeners.push(cb);
    return { remove: jest.fn() };
  });
  const getPermissionsAsync = jest.fn(async () => ({
    granted: opts.granted ?? true,
    ios: { status: opts.iosStatus ?? 0 },
  }));
  const requestPermissionsAsync = jest.fn(async () => ({ granted: true }));
  const getExpoPushTokenAsync = jest.fn(async () => ({ data: opts.token ?? TOKEN }));
  const apiPost = opts.apiPost ?? jest.fn(async () => ({ ok: true }));
  const recordError = jest.fn();

  jest.doMock("expo-device", () => ({ isDevice: opts.isDevice ?? true }));
  jest.doMock("react-native", () => ({
    Platform: { OS: opts.platform ?? "ios" },
    AppState: { addEventListener },
  }));
  jest.doMock("expo-notifications", () => ({
    getPermissionsAsync,
    requestPermissionsAsync,
    getExpoPushTokenAsync,
    IosAuthorizationStatus: { PROVISIONAL: 3 },
  }));
  jest.doMock("expo-constants", () => ({
    __esModule: true,
    default: { expoConfig: { extra: { eas: { projectId: "proj" } } } },
  }));
  jest.doMock("@/services/apiClient", () => ({ apiPost }));
  jest.doMock("@/services/diagnostics", () => ({ recordError }));

  const mod = require("@/services/notifications/push");
  return {
    mod,
    listeners,
    mocks: {
      addEventListener,
      getPermissionsAsync,
      requestPermissionsAsync,
      getExpoPushTokenAsync,
      apiPost,
      recordError,
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r));
};

async function savedToken() {
  const raw = await AsyncStorage.getItem("push_token_v1");
  return raw ? JSON.parse(raw) : null;
}

describe("push registration", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("registers when on iOS, a real device, permission granted and the switch unset", async () => {
    const { mod, mocks } = load();
    await mod.syncPushRegistration();
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "proj" });
    expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/register", { token: TOKEN });
    expect((await mod.readSavedPushToken())).toBe(TOKEN);
    expect((await savedToken()).registeredAt).toEqual(expect.any(Number));
  });

  it("treats provisional permission as granted", async () => {
    const { mod, mocks } = load({ granted: false, iosStatus: 3 });
    await mod.syncPushRegistration();
    expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/register", { token: TOKEN });
  });

  it("does not register when permission is denied", async () => {
    const { mod, mocks } = load({ granted: false });
    await mod.syncPushRegistration();
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.apiPost).not.toHaveBeenCalled();
  });

  it.each([
    ["android", true],
    ["ios", false],
  ] as const)("does nothing on %s / isDevice=%s", async (platform, isDevice) => {
    await AsyncStorage.setItem("push_token_v1", JSON.stringify({ token: TOKEN, registeredAt: 1 }));
    const { mod, mocks } = load({ platform, isDevice });
    await mod.syncPushRegistration();
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.apiPost).not.toHaveBeenCalled();
  });

  it("never requests permission", async () => {
    for (const opts of [{}, { granted: false }, { granted: false, iosStatus: 3 }]) {
      const { mod, mocks } = load(opts);
      await mod.syncPushRegistration();
      await mod.setAnnouncementsEnabled(false);
      expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    }
  });

  it("skips the token fetch and the POST within 24h, does both again after", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const { mod, mocks } = load();
    await mod.syncPushRegistration();
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + DAY - 1);
    await mod.syncPushRegistration();
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + DAY);
    await mod.syncPushRegistration();
    expect(mocks.apiPost).toHaveBeenCalledTimes(2);
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(2);
    expect((await savedToken()).registeredAt).toBe(1_000_000 + DAY);
  });

  it("registers the fetched token once the saved registration is stale", async () => {
    await AsyncStorage.setItem("push_token_v1", JSON.stringify({ token: "old", registeredAt: 1 }));
    const { mod, mocks } = load();
    await mod.syncPushRegistration();
    expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/register", { token: TOKEN });
    expect(await mod.readSavedPushToken()).toBe(TOKEN);
  });

  it("treats a saved registration dated in the future as stale", async () => {
    await AsyncStorage.setItem(
      "push_token_v1",
      JSON.stringify({ token: TOKEN, registeredAt: Date.now() + DAY }),
    );
    const { mod, mocks } = load();
    await mod.syncPushRegistration();
    expect(mocks.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/register", { token: TOKEN });
  });

  it("switch off: stores \"0\", unregisters the saved token and clears it", async () => {
    const { mod, mocks } = load();
    await mod.syncPushRegistration();
    mocks.apiPost.mockClear();

    await mod.setAnnouncementsEnabled(false);
    expect(await AsyncStorage.getItem("notif_announcements_v1")).toBe("0");
    expect(await mod.readAnnouncementsEnabled()).toBe(false);
    expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/unregister", { token: TOKEN });
    expect(await mod.readSavedPushToken()).toBeNull();
  });

  it("switch on: stores \"1\" and registers", async () => {
    await AsyncStorage.setItem("notif_announcements_v1", "0");
    const { mod, mocks } = load();
    expect(await mod.readAnnouncementsEnabled()).toBe(false);

    await mod.setAnnouncementsEnabled(true);
    expect(await AsyncStorage.getItem("notif_announcements_v1")).toBe("1");
    expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/register", { token: TOKEN });
  });

  it("reads the switch as on when unset", async () => {
    const { mod } = load();
    expect(await mod.readAnnouncementsEnabled()).toBe(true);
  });

  it("permission revoked with a saved token: unregisters without fetching a new token", async () => {
    await AsyncStorage.setItem("push_token_v1", JSON.stringify({ token: TOKEN, registeredAt: Date.now() }));
    const { mod, mocks } = load({ granted: false });
    await mod.syncPushRegistration();
    expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/unregister", { token: TOKEN });
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(await mod.readSavedPushToken()).toBeNull();
  });

  it("a failed unregister keeps the saved token and retries on the next foreground", async () => {
    await AsyncStorage.setItem("push_token_v1", JSON.stringify({ token: TOKEN, registeredAt: Date.now() }));
    await AsyncStorage.setItem("notif_announcements_v1", "0");
    const apiPost = jest.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue({ ok: true });
    const { mod, listeners, mocks } = load({ apiPost });

    mod.initPushRegistration();
    await flush();
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
    expect(await mod.readSavedPushToken()).toBe(TOKEN);

    listeners[0]("active");
    await flush();

    expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/unregister", { token: TOKEN });
    expect(await mod.readSavedPushToken()).toBeNull();
  });

  it("a failed unregister after permission is revoked keeps the saved token and retries on the next foreground", async () => {
    await AsyncStorage.setItem("push_token_v1", JSON.stringify({ token: TOKEN, registeredAt: Date.now() }));
    const apiPost = jest.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue({ ok: true });
    const { mod, listeners, mocks } = load({ apiPost, granted: false });

    mod.initPushRegistration();
    await flush();
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
    expect(await mod.readSavedPushToken()).toBe(TOKEN);

    listeners[0]("active");
    await flush();

    expect(mocks.apiPost).toHaveBeenCalledTimes(2);
    expect(mocks.apiPost).toHaveBeenLastCalledWith("/api/push/unregister", { token: TOKEN });
    expect(mocks.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(await mod.readSavedPushToken()).toBeNull();
  });

  it("a failed register records a fixed bug-log message with no token and does not throw", async () => {
    const apiPost = jest.fn().mockRejectedValue(new Error(`boom ${TOKEN}`));
    const { mod, mocks } = load({ apiPost });

    await expect(mod.syncPushRegistration()).resolves.toBeUndefined();
    expect(mocks.recordError).toHaveBeenCalledTimes(1);
    const args = mocks.recordError.mock.calls[0];
    expect(args[0]).toBe("error");
    expect(args[1]).toEqual(new Error("Push registration failed"));
    expect(JSON.stringify(args)).not.toContain(TOKEN);
  });

  it("a failed register leaves a stale saved token that a switch-off unregisters", async () => {
    const apiPost = jest.fn().mockRejectedValueOnce(new Error("lost")).mockResolvedValue({ ok: true });
    const { mod, mocks } = load({ apiPost });

    await mod.syncPushRegistration();
    expect(await savedToken()).toEqual({ token: TOKEN, registeredAt: 0 });

    await mod.setAnnouncementsEnabled(false);
    expect(mocks.apiPost).toHaveBeenLastCalledWith("/api/push/unregister", { token: TOKEN });
    expect(await mod.readSavedPushToken()).toBeNull();
  });

  it("a failed register is retried on the next run without waiting a day", async () => {
    const apiPost = jest.fn().mockRejectedValueOnce(new Error("lost")).mockResolvedValue({ ok: true });
    const { mod, mocks } = load({ apiPost });

    await mod.syncPushRegistration();
    await mod.syncPushRegistration();
    expect(mocks.apiPost).toHaveBeenCalledTimes(2);
    expect((await savedToken()).registeredAt).toBeGreaterThan(0);
  });

  it("logs a failure once per session", async () => {
    const apiPost = jest.fn().mockRejectedValue(new Error("down"));
    const { mod, mocks } = load({ apiPost });

    await mod.syncPushRegistration();
    await mod.syncPushRegistration();
    expect(mocks.apiPost).toHaveBeenCalledTimes(2);
    expect(mocks.recordError).toHaveBeenCalledTimes(1);
  });

  describe("token fetch timeout", () => {
    afterEach(() => jest.useRealTimers());

    it("gives up on a hung token fetch, logs it, and does not stall the queue", async () => {
      jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] });
      const { mod, mocks } = load();
      mocks.getExpoPushTokenAsync.mockImplementationOnce(() => new Promise(() => {}));

      const first = mod.syncPushRegistration();
      await flush();
      expect(mocks.recordError).not.toHaveBeenCalled();
      jest.advanceTimersByTime(mod.TOKEN_TIMEOUT_MS);
      await first;

      expect(mocks.recordError).toHaveBeenCalledTimes(1);
      expect(mocks.apiPost).not.toHaveBeenCalled();

      await mod.syncPushRegistration();
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/push/register", { token: TOKEN });
    });

    it("clears the timer when the token arrives in time", async () => {
      jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] });
      const { mod } = load();
      await mod.syncPushRegistration();
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  it("concurrent syncs run one after another; final state wins", async () => {
    await AsyncStorage.setItem("push_token_v1", JSON.stringify({ token: TOKEN, registeredAt: 1 }));
    let inFlight = 0;
    let maxInFlight = 0;
    const order: string[] = [];
    const apiPost = jest.fn(async (path: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      order.push(path);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { ok: true };
    });
    const { mod } = load({ apiPost });

    const first = mod.syncPushRegistration();
    const second = mod.setAnnouncementsEnabled(false);
    await Promise.all([first, second]);

    expect(maxInFlight).toBe(1);
    expect(await mod.readSavedPushToken()).toBeNull();
    const lastUnregister = order.lastIndexOf("/api/push/unregister");
    expect(lastUnregister).toBeGreaterThan(-1);
    const lastRegister = order.lastIndexOf("/api/push/register");
    expect(lastRegister).toBeLessThan(lastUnregister);
  });

  it("initPushRegistration is idempotent and syncs now", async () => {
    const { mod, mocks } = load();
    mod.initPushRegistration();
    mod.initPushRegistration();
    expect(mocks.addEventListener).toHaveBeenCalledTimes(1);
    expect(mocks.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    await flush();
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
  });
});
