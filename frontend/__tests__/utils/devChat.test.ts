import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEV_CHAT_BYPASS_KEY,
  getChatDevBypass,
  isChatDevBypass,
  loadChatDevBypass,
  setChatDevBypass,
  subscribeChatDevBypass,
} from "@/utils/devChat";

const devGlobal = global as unknown as { __DEV__: boolean };
const realDev = devGlobal.__DEV__;

describe("devChat", () => {
  beforeEach(async () => {
    devGlobal.__DEV__ = true;
    await AsyncStorage.clear();
    await setChatDevBypass(false);
  });

  afterEach(() => {
    devGlobal.__DEV__ = realDev;
  });

  it("is off by default", async () => {
    await loadChatDevBypass();

    expect(isChatDevBypass()).toBe(false);
    expect(await getChatDevBypass()).toBe(false);
  });

  it("stores the choice as 1 or 0 and keeps the synchronous copy in step", async () => {
    await setChatDevBypass(true);

    expect(await AsyncStorage.getItem(DEV_CHAT_BYPASS_KEY)).toBe("1");
    expect(isChatDevBypass()).toBe(true);
    expect(await getChatDevBypass()).toBe(true);

    await setChatDevBypass(false);

    expect(await AsyncStorage.getItem(DEV_CHAT_BYPASS_KEY)).toBe("0");
    expect(isChatDevBypass()).toBe(false);
  });

  it("loads the stored choice at startup", async () => {
    await AsyncStorage.setItem(DEV_CHAT_BYPASS_KEY, "1");

    await loadChatDevBypass();

    expect(isChatDevBypass()).toBe(true);
  });

  it("tells subscribers when the choice changes, and stops after unsubscribing", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeChatDevBypass(listener);

    await setChatDevBypass(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await setChatDevBypass(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("never turns on outside dev builds", async () => {
    devGlobal.__DEV__ = false;
    await AsyncStorage.clear();

    await setChatDevBypass(true);
    expect(await AsyncStorage.getItem(DEV_CHAT_BYPASS_KEY)).toBeNull();
    expect(isChatDevBypass()).toBe(false);

    await AsyncStorage.setItem(DEV_CHAT_BYPASS_KEY, "1");
    await loadChatDevBypass();
    expect(isChatDevBypass()).toBe(false);
    expect(await getChatDevBypass()).toBe(false);
  });
});
