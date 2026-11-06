import { randomUUID, sign } from "node:crypto";
import { ENV } from "../../config/env.js";
import { MONTHLY_ALLOWANCE, REDUCED_ALLOWANCE, currentMonth } from "./quota.js";

const TIMEOUT_MS = 5_000;
const JWT_TTL_MS = 50 * 60 * 1000; // Apple accepts tokens up to an hour old

const host = () =>
  ENV.DEVICECHECK_ENV === "development"
    ? "https://api.development.devicecheck.apple.com"
    : "https://api.devicecheck.apple.com";

let cachedJwt: { token: string; expires: number } | null = null;

/** ES256 JWT for Apple's DeviceCheck server API, built like an APNs provider token. */
export function appleJwt(): string {
  const now = Date.now();
  if (cachedJwt && cachedJwt.expires > now) return cachedJwt.token;
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${part({ alg: "ES256", kid: ENV.DEVICECHECK_KEY_ID })}.${part({ iss: ENV.DEVICECHECK_TEAM_ID, iat: Math.floor(now / 1000) })}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key: ENV.DEVICECHECK_PRIVATE_KEY, dsaEncoding: "ieee-p1363" });
  cachedJwt = { token: `${unsigned}.${signature.toString("base64url")}`, expires: now + JWT_TTL_MS };
  return cachedJwt.token;
}

function call(path: string, deviceToken: string, extra: object = {}) {
  return fetch(`${host()}/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appleJwt()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ device_token: deviceToken, transaction_id: randomUUID(), timestamp: Date.now(), ...extra }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * The month's allowance for an account making its first claim. Bit 0 on the
 * device means "a free quota was claimed here"; Apple's last_update_time says
 * which month. A second account on the same device that month gets the
 * reduced allowance. Apple failing on our side never cuts a real user back.
 */
export async function decideAllowance(deviceToken: string | null, now = new Date()): Promise<number> {
  if (!ENV.DEVICECHECK_REQUIRED) return MONTHLY_ALLOWANCE;
  if (!deviceToken) return REDUCED_ALLOWANCE;

  let res: Response;
  try {
    res = await call("query_two_bits", deviceToken);
  } catch (err) {
    console.error("chat_devicecheck_unavailable", (err as Error)?.name);
    return MONTHLY_ALLOWANCE;
  }
  if (res.status === 400) return REDUCED_ALLOWANCE;
  if (res.status !== 200) {
    console.error("chat_devicecheck_unavailable", res.status);
    return MONTHLY_ALLOWANCE;
  }

  // Apple answers 200 with a plain-text body when no bits were ever set.
  let bits: { bit0?: boolean; last_update_time?: string } = {};
  try {
    bits = JSON.parse(await res.text()) ?? {};
  } catch {
    // unset
  }
  if (bits.bit0 === true && bits.last_update_time === currentMonth(now)) return REDUCED_ALLOWANCE;

  try {
    const update = await call("update_two_bits", deviceToken, { bit0: true, bit1: false });
    if (update.status !== 200) console.error("chat_devicecheck_update_failed", update.status);
  } catch (err) {
    console.error("chat_devicecheck_update_failed", (err as Error)?.name);
  }
  return MONTHLY_ALLOWANCE;
}
