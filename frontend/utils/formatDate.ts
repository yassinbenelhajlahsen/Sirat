function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** "Nov 1st", "Mar 22nd". */
export function formatMonthDay(date: Date): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  return `${month} ${ordinal(date.getDate())}`;
}

/** "Sun, Nov 1st". */
export function formatWeekdayMonthDay(date: Date): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  return `${weekday}, ${formatMonthDay(date)}`;
}
