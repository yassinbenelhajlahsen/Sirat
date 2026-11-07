export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const BATCH_SIZE = 100;
export const BATCH_PAUSE_MS = 200; // 100 per batch stays under Expo's 600 per second
export const MAX_ATTEMPTS = 3;
export const RETRY_BASE_MS = 1000;

export type AnnounceArgs = { title: string; body: string; mode: "dry" | "test" | "all" };

export function parseAnnounceArgs(argv: string[]): AnnounceArgs | { error: string } {
  let title: string | undefined;
  let body: string | undefined;
  let test = false;
  let all = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--title" || arg === "--body") {
      const value = argv[++i];
      if (value === undefined) return { error: `${arg} needs a value` };
      if (arg === "--title") title = value.trim();
      else body = value.trim();
    } else if (arg === "--test") test = true;
    else if (arg === "--all") all = true;
    else return { error: `Unknown argument ${arg}` };
  }
  if (test && all) return { error: "Use --test or --all, not both" };
  if (!title || title.length > 100) return { error: "--title is required, 1 to 100 characters" };
  if (!body || body.length > 500) return { error: "--body is required, 1 to 500 characters" };
  return { title, body, mode: all ? "all" : test ? "test" : "dry" };
}

export function databaseLabel(url: string): "local database" | "remote database" {
  try {
    const { hostname } = new URL(url);
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname) ? "local database" : "remote database";
  } catch {
    return "local database";
  }
}

export type SendResult = { sent: number; accepted: number; errors: number; deadTokens: string[] };

type Deps = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  accessToken?: string;
};

type Ticket = { status?: string; details?: { error?: string } };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function sendAnnouncement(
  tokens: string[],
  message: { title: string; body: string },
  deps: Deps = {},
): Promise<SendResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (deps.accessToken) headers.Authorization = `Bearer ${deps.accessToken}`;

  const result: SendResult = { sent: tokens.length, accepted: 0, errors: 0, deadTokens: [] };

  for (let start = 0; start < tokens.length; start += BATCH_SIZE) {
    if (start > 0) await sleep(BATCH_PAUSE_MS);
    const batch = tokens.slice(start, start + BATCH_SIZE);
    const payload = JSON.stringify(
      batch.map((to) => ({ to, title: message.title, body: message.body, sound: "default" })),
    );

    let tickets: Ticket[] | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
      let res: Response;
      try {
        res = await fetchImpl(EXPO_PUSH_URL, {
          method: "POST",
          headers,
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        continue;
      }
      if (res.status === 429 || res.status >= 500) continue;
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
        if (Array.isArray(json?.data) && json.data.length === batch.length) tickets = json.data as Ticket[];
      }
      break;
    }

    if (!tickets) {
      result.errors += batch.length;
      continue;
    }
    tickets.forEach((ticket, i) => {
      if (ticket?.status === "ok") result.accepted++;
      else {
        result.errors++;
        if (ticket?.details?.error === "DeviceNotRegistered") result.deadTokens.push(batch[i]);
      }
    });
  }

  return result;
}
