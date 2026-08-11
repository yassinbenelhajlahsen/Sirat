import { useEffect, useMemo, useRef, useState } from "react";

const getMonthMatrix = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay();
  const numDays = new Date(year, month + 1, 0).getDate();

  const weeks: number[][] = [];
  let day = 1 - firstDay;
  for (let i = 0; i < 6; i++) {
    const week: number[] = [];
    for (let j = 0; j < 7; j++) {
      week.push(day > 0 && day <= numDays ? day : 0);
      day++;
    }
    weeks.push(week);
  }
  return weeks;
};

export function useCalendarViewState({
  monthParam,
  yearParam,
  isSmall,
}: {
  monthParam: string | string[] | undefined;
  yearParam: string | string[] | undefined;
  isSmall: boolean;
}) {
  const today = new Date();
  const initialMonth =
    typeof monthParam === "string" ? parseInt(monthParam, 10) : today.getMonth();
  const initialYear =
    typeof yearParam === "string" ? parseInt(yearParam, 10) : today.getFullYear();
  const initialIsViewingToday =
    initialMonth === today.getMonth() && initialYear === today.getFullYear();

  const minDate = new Date(today.getFullYear() - 1, 0);
  const maxDate = new Date(today.getFullYear() + 2, 11);

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const viewMonthRef = useRef(viewMonth);
  const viewYearRef = useRef(viewYear);

  useEffect(() => {
    viewMonthRef.current = viewMonth;
    viewYearRef.current = viewYear;
  }, [viewMonth, viewYear]);

  const isViewingToday =
    viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const canGoPrev = new Date(viewYear, viewMonth - 1) >= minDate;
  const canGoNext = new Date(viewYear, viewMonth + 1) <= maxDate;
  const dayButtonSize = isSmall ? 34 : 40;

  const matrix = useMemo(
    () => getMonthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const visibleMatrix = useMemo(() => {
    let lastWeekWithDates = matrix.length - 1;
    while (
      lastWeekWithDates >= 0 &&
      matrix[lastWeekWithDates].every((day) => day === 0)
    ) {
      lastWeekWithDates -= 1;
    }

    return matrix.slice(0, Math.max(lastWeekWithDates + 1, 1));
  }, [matrix]);

  const monthName = useMemo(
    () =>
      new Date(viewYear, viewMonth).toLocaleString("default", {
        month: "long",
      }),
    [viewYear, viewMonth],
  );

  return {
    today,
    minDate,
    maxDate,
    viewYear,
    setViewYear,
    viewMonth,
    setViewMonth,
    viewMonthRef,
    viewYearRef,
    initialIsViewingToday,
    isViewingToday,
    canGoPrev,
    canGoNext,
    dayButtonSize,
    fullMatrix: matrix,
    visibleMatrix,
    monthName,
  };
}
