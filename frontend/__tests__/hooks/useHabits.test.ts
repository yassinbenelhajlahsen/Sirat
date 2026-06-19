// frontend/__tests__/hooks/useHabits.test.ts
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHabits } from "@/hooks/useHabits";

describe("useHabits", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("creates a habit and reflects it in the active list", async () => {
    const { result } = renderHook(() => useHabits());
    await act(async () => {
      await result.current.create({ name: "Read Qur'an", icon: "book-outline", frequency: { type: "daily" } });
    });
    await waitFor(() =>
      expect(result.current.habits.some((h) => h.name === "Read Qur'an")).toBe(true),
    );
  });

  it("archiving removes a habit from the active list", async () => {
    const { result } = renderHook(() => useHabits());
    let id = "";
    await act(async () => {
      const h = await result.current.create({ name: "Tahajjud", icon: "moon-outline", frequency: { type: "weekly", days: [1, 4] } });
      id = h.id;
    });
    await waitFor(() => expect(result.current.habits.some((h) => h.id === id)).toBe(true));
    await act(async () => {
      await result.current.archive(id);
    });
    await waitFor(() => expect(result.current.habits.some((h) => h.id === id)).toBe(false));
  });
});
