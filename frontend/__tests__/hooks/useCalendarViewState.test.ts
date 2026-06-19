import { act, renderHook } from "@testing-library/react-native";

import { useCalendarViewState } from "@/hooks/useCalendarViewState";

describe("hooks/useCalendarViewState", () => {
  it("parses string month/year params and builds a trimmed month matrix", () => {
    const { result } = renderHook(() =>
      useCalendarViewState({
        monthParam: "2",
        yearParam: "2026",
        isSmall: false,
      }),
    );

    expect(result.current.viewMonth).toBe(2);
    expect(result.current.viewYear).toBe(2026);
    expect(result.current.monthName).toBe(
      new Date(2026, 2).toLocaleString("default", { month: "long" }),
    );
    expect(result.current.visibleMatrix).toHaveLength(5);
    expect(result.current.visibleMatrix[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.current.visibleMatrix[4]).toEqual([29, 30, 31, 0, 0, 0, 0]);
    expect(result.current.dayButtonSize).toBe(40);
  });

  it("falls back to today's month/year when route params are arrays", () => {
    const { result } = renderHook(() =>
      useCalendarViewState({
        monthParam: ["2"],
        yearParam: ["2026"],
        isSmall: false,
      }),
    );

    expect(result.current.viewMonth).toBe(result.current.today.getMonth());
    expect(result.current.viewYear).toBe(result.current.today.getFullYear());
    expect(result.current.initialIsViewingToday).toBe(true);
    expect(result.current.isViewingToday).toBe(true);
  });

  it("enforces previous/next navigation boundaries to current year through next year", () => {
    const { result } = renderHook(() =>
      useCalendarViewState({
        monthParam: undefined,
        yearParam: undefined,
        isSmall: false,
      }),
    );
    const currentYear = result.current.today.getFullYear();

    act(() => {
      result.current.setViewYear(currentYear);
      result.current.setViewMonth(0);
    });

    expect(result.current.canGoPrev).toBe(false);
    expect(result.current.canGoNext).toBe(true);

    act(() => {
      result.current.setViewYear(currentYear + 1);
      result.current.setViewMonth(11);
    });

    expect(result.current.canGoPrev).toBe(true);
    expect(result.current.canGoNext).toBe(false);
  });

  it("uses compact day button size for small screens", () => {
    const { result } = renderHook(() =>
      useCalendarViewState({
        monthParam: undefined,
        yearParam: undefined,
        isSmall: true,
      }),
    );

    expect(result.current.dayButtonSize).toBe(34);
  });

  it("exposes a full 6-row matrix regardless of month length", () => {
    const { result } = renderHook(() =>
      useCalendarViewState({ monthParam: "1", yearParam: "2027", isSmall: false }),
    );
    // February 2027 fits in 4 visible weeks, but fullMatrix is always 6 rows.
    expect(result.current.fullMatrix).toHaveLength(6);
    expect(result.current.fullMatrix.every((w) => w.length === 7)).toBe(true);
    expect(result.current.visibleMatrix.length).toBeLessThan(6);
  });
});
