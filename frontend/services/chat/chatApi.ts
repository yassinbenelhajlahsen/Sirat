import { apiFetch } from "@/services/apiClient";
import { isChatDevBypass } from "@/utils/devChat";

// Mirrors the server's chat contract (backend/src/services/chat). Keep in step with it.
export type Citation =
  | { kind: "quran"; surah: number; ayah: number; arabic: string; english: string | null }
  | {
      kind: "hadith";
      id: number;
      title: string;
      text: string;
      arabic: string | null;
      grade: string;
      source: string;
      credit: string;
    }
  | {
      kind: "dua";
      id: number;
      arabic: string;
      transliteration: string;
      english: string;
      reference: string;
    };

export type ChatTurn = { role: "user" | "assistant"; text: string };

export type ChatRequest = {
  message: string;
  history: ChatTurn[];
  summary: string | null;
  deviceToken: string | null;
};

type Allowance = { allowance: number; remaining: number; resetsAt: string };

export type ChatReply =
  | ({
      kind: "answer";
      answer: string;
      citations: Citation[];
      scholarLink: string | null;
      summary: string;
    } & Allowance)
  | ({ kind: "crisis" } & Allowance)
  | ({ kind: "blocked" } & Allowance)
  | ({ kind: "limit"; remaining: 0 } & Allowance);

export type ChatStatus = {
  enabled: boolean;
  allowance: number | null;
  remaining: number | null;
  resetsAt: string;
};

// Only a local server with CHAT_DEV_BYPASS=1 reads this; production builds never turn the bypass on.
function devHeaders(): Record<string, string> | undefined {
  return isChatDevBypass() ? { "x-sirat-chat-dev": "1" } : undefined;
}

export function getChatStatus(): Promise<ChatStatus> {
  return apiFetch<ChatStatus>("/api/chat/status", { headers: devHeaders() });
}

export function sendChat(body: ChatRequest): Promise<ChatReply> {
  return apiFetch<ChatReply>("/api/chat", { method: "POST", body, headers: devHeaders() });
}
