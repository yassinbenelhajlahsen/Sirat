import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearDuaHistory, getDuaHistory, getRecentDuas, requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";

const GENERAL_DUA_ID = 100;

describe("services/duaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a dua from the matched regex category", async () => {
    const request = requestDua("I am studying for my exam and need help");

    await jest.advanceTimersByTimeAsync(1200);

    const { dua, notice } = await request;

    expect(dua.category).toBe("exam");
    expect(notice).toBeNull();
  });

  it("returns the general dua with the no-match notice when nothing matches", async () => {
    const request = requestDua("totally unmatched request phrase");

    await jest.advanceTimersByTimeAsync(1200);

    const { dua, notice } = await request;

    expect(dua.id).toBe(GENERAL_DUA_ID);
    expect(notice).toBe("no-match");
  });

  it("returns a chosen crisis dua with the crisis notice", async () => {
    const selfHarm = requestDua("I want to kill myself");
    const abuse = requestDua("my husband hits me");
    await jest.advanceTimersByTimeAsync(300);

    expect(await selfHarm).toMatchObject({ notice: "crisis", dua: { id: 39 } });
    expect(await abuse).toMatchObject({ notice: "crisis", dua: { id: 114 } });
  });

  it("only returns sleep duas for a sleep request", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const request = requestDua("I can't sleep");
      await jest.advanceTimersByTimeAsync(1200);
      seen.add((await request).dua.category);
    }
    expect([...seen]).toEqual(["sleep"]);
  });

  it("never stores what was typed or whether a notice showed", async () => {
    await AsyncStorage.clear();
    const request = requestDua("I want to kill myself");
    await jest.advanceTimersByTimeAsync(1200);
    const { dua } = await request;
    await saveDuaToHistory(dua);

    const raw = (await AsyncStorage.getItem("dua_history_v1")) ?? "";
    expect(raw).not.toMatch(/kill myself|crisis|notice|no-match/i);
    expect(Object.keys(JSON.parse(raw)[0]).sort()).toEqual(
      ["arabic", "category", "english", "id", "reference", "source", "transliteration"],
    );
  });

  it("rejects an empty request", async () => {
    await expect(requestDua("   ")).rejects.toThrow("Please enter what you need help with");
  });

  it("applies simulated delay for fast local matches", async () => {
    let settled = false;
    const promise = requestDua("exam tomorrow")
      .then(() => {
        settled = true;
      });

    await Promise.resolve();
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(299);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await promise;
    expect(settled).toBe(true);
  });

  it("caps history to 10 items and persists latest-first order", async () => {
    await clearDuaHistory();

    for (let i = 1; i <= 11; i += 1) {
      const dua: Dua = {
        id: i,
        category: `c-${i}`,
        arabic: `a-${i}`,
        english: `e-${i}`,
        transliteration: `t-${i}`,
        reference: `r-${i}`,
        source: "test",
      };
      await saveDuaToHistory(dua);
    }

    const raw = await AsyncStorage.getItem("dua_history_v1");
    const parsed = raw ? (JSON.parse(raw) as Dua[]) : [];

    expect(parsed).toHaveLength(10);
    expect(parsed[0].id).toBe(11);
    expect(parsed[9].id).toBe(2);

    const history = await getDuaHistory();
    expect(history).toHaveLength(10);
    expect(history[0].id).toBe(11);
  });

  it("moves a re-shown dua to the front instead of repeating it", async () => {
    await clearDuaHistory();
    const make = (id: number): Dua => ({
      id,
      category: "c",
      arabic: "a",
      english: "e",
      transliteration: "t",
      reference: "r",
      source: "test",
    });

    await saveDuaToHistory(make(1));
    await saveDuaToHistory(make(2));
    await saveDuaToHistory(make(1));

    expect((await getDuaHistory()).map((d) => d.id)).toEqual([1, 2]);
  });

  it("getRecentDuas drops repeats left by older builds", async () => {
    const make = (id: number) => ({ id, category: "c", arabic: "a", english: "e", transliteration: "t", reference: "r", source: "s" });
    await AsyncStorage.setItem(
      "dua_history_v1",
      JSON.stringify([make(4), make(2), make(4), make(1)]),
    );

    expect((await getRecentDuas()).map((d) => d.id)).toEqual([4, 2, 1]);
  });
});
