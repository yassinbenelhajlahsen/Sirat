/** Epoch-ms wrapper so timestamps are mockable in tests. */
export function nowMs(): number {
  return Date.now();
}

/** RFC4122-ish v4 id. Not cryptographically strong; just collision-safe enough
 *  to keep two offline devices from minting the same habit id before sync. */
export function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
