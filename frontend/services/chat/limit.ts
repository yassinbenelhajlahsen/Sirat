export function limitLines(allowance: number | null, resetsAt: string | null): [string, string] {
  const count = allowance === null ? "" : `${allowance} `;
  // UTC so the date matches the server's month boundary on every device.
  const when = resetsAt
    ? `on ${new Date(resetsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", timeZone: "UTC" })}`
    : "at the start of next month";
  return [`You've used this month's ${count}messages.`, `They reset ${when}.`];
}

export function limitMessage(allowance: number | null, resetsAt: string | null): string {
  return limitLines(allowance, resetsAt).join(" ");
}
