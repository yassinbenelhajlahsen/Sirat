/**
 * Returns true if `current` is strictly less than `minimum`.
 * Treats unparseable versions as outdated (returns true).
 */
export function isVersionLessThan(current: string, minimum: string): boolean {
  const parseVersion = (v: string): number[] | null => {
    const parts = v.split(".");
    if (parts.length !== 3) return null;
    const nums = parts.map(Number);
    if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;
    return nums;
  };

  const cur = parseVersion(current);
  const min = parseVersion(minimum);

  if (!cur || !min) return true;

  for (let i = 0; i < 3; i++) {
    if (cur[i] < min[i]) return true;
    if (cur[i] > min[i]) return false;
  }
  return false;
}
