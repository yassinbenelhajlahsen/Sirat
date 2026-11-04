/** Local "YYYY-MM-DD" key for a date. The one date-key format used for storage and lookups. */
export function dateKeyFromDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
