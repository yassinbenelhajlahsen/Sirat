import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { generateKeyPairSync, verify } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const NOV = new Date("2026-11-15T12:00:00Z");

const mockFetch: jest.Mock = jest.fn();
const json = (status: number, body: unknown) => ({ status, ok: status < 300, text: async () => JSON.stringify(body) });
const text = (status: number, body: string) => ({ status, ok: status < 300, text: async () => body });

describe("decideAllowance", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
    (globalThis as any).fetch = mockFetch;
    process.env.DEVICECHECK_REQUIRED = "1";
    process.env.DEVICECHECK_ENV = "production";
    process.env.DEVICECHECK_TEAM_ID = "TEAM123456";
    process.env.DEVICECHECK_KEY_ID = "KEY1234567";
    process.env.DEVICECHECK_PRIVATE_KEY = PEM.replace(/\n/g, "\\n");
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  const load = async () => await import("../src/services/chat/deviceCheck.js");
  const bodyOf = (call: number) => JSON.parse((mockFetch.mock.calls[call][1] as any).body);
  const urlOf = (call: number) => mockFetch.mock.calls[call][0] as string;

  it("gives the full allowance without asking Apple when DeviceCheck is turned off", async () => {
    process.env.DEVICECHECK_REQUIRED = "0";
    const { decideAllowance } = await load();

    expect(await decideAllowance(null, NOV)).toBe(15);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("gives the reduced allowance with no device token", async () => {
    const { decideAllowance } = await load();

    expect(await decideAllowance(null, NOV)).toBe(5);
    expect(await decideAllowance("", NOV)).toBe(5);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("gives the reduced allowance when Apple rejects the token", async () => {
    (mockFetch as any).mockResolvedValue(text(400, "Missing or badly formatted device token payload"));
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(5);
  });

  it.each([500, 503, 429, 401])("gives the full allowance and logs when Apple answers %i", async (status) => {
    (mockFetch as any).mockResolvedValue(text(status, "error"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(15);
    expect(errorSpy).toHaveBeenCalledWith("chat_devicecheck_unavailable", status);
    errorSpy.mockRestore();
  });

  it("gives the full allowance on a network error or timeout", async () => {
    (mockFetch as any)
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(15);
    expect(await decideAllowance("tok", NOV)).toBe(15);
    expect((mockFetch.mock.calls[0][1] as any).signal).toBeDefined();
  });

  it("gives the reduced allowance when another account claimed on this device this month", async () => {
    (mockFetch as any).mockResolvedValue(json(200, { bit0: true, bit1: false, last_update_time: "2026-11" }));
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(5);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("ignores a bit set last month, sets it again and gives the full allowance", async () => {
    (mockFetch as any)
      .mockResolvedValueOnce(json(200, { bit0: true, bit1: false, last_update_time: "2026-10" }))
      .mockResolvedValueOnce(text(200, ""));
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(15);
    expect(urlOf(1)).toBe("https://api.devicecheck.apple.com/v1/update_two_bits");
    expect(bodyOf(1)).toMatchObject({ device_token: "tok", bit0: true, bit1: false });
  });

  it("treats Apple's non-JSON 'bit state not found' reply as unset", async () => {
    (mockFetch as any)
      .mockResolvedValueOnce(text(200, "Failed to find bit state"))
      .mockResolvedValueOnce(text(200, ""));
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(15);
    expect(urlOf(1)).toMatch(/update_two_bits$/);
  });

  it("treats a JSON null body as unset", async () => {
    (mockFetch as any).mockResolvedValueOnce(text(200, "null")).mockResolvedValueOnce(text(200, ""));
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(15);
  });

  it("still gives the full allowance when setting the bit fails", async () => {
    (mockFetch as any)
      .mockResolvedValueOnce(json(200, { bit0: false, bit1: false, last_update_time: "2026-11" }))
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(15);
  });

  it("sends the token, a transaction id and a millisecond timestamp with a bearer JWT", async () => {
    (mockFetch as any).mockResolvedValue(json(200, { bit0: true, bit1: false, last_update_time: "2026-11" }));
    const { decideAllowance } = await load();

    await decideAllowance("tok", NOV);

    expect(urlOf(0)).toBe("https://api.devicecheck.apple.com/v1/query_two_bits");
    const init = mockFetch.mock.calls[0][1] as any;
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    const body = bodyOf(0);
    expect(body.device_token).toBe("tok");
    expect(typeof body.transaction_id).toBe("string");
    expect(body.timestamp).toBeGreaterThan(1_700_000_000_000);
  });

  it("uses Apple's development host in development", async () => {
    process.env.DEVICECHECK_ENV = "development";
    (mockFetch as any).mockResolvedValue(json(200, { bit0: true, bit1: false, last_update_time: "2026-11" }));
    const { decideAllowance } = await load();

    await decideAllowance("tok", NOV);

    expect(urlOf(0)).toBe("https://api.development.devicecheck.apple.com/v1/query_two_bits");
  });

  it("signs an ES256 JWT that verifies with the public key", async () => {
    const { appleJwt } = await load();
    const token = appleJwt();
    const [h, p, s] = token.split(".");
    const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

    expect(decode(h)).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(decode(p)).toMatchObject({ iss: "TEAM123456" });
    expect(Number.isInteger(decode(p).iat)).toBe(true);
    const ok = verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
    expect(appleJwt()).toBe(token); // cached
  });

  it("gives the full allowance and logs when the key is missing", async () => {
    process.env.DEVICECHECK_PRIVATE_KEY = "";
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { decideAllowance } = await load();

    expect(await decideAllowance("tok", NOV)).toBe(15);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
