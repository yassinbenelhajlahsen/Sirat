import { useCallback, useEffect, useRef, useState } from "react";

import { getChatStatus, sendChat, type ChatReply, type ChatTurn } from "@/services/chat/chatApi";
import { chatGeneration, loadChat, saveChat, type ChatMessage, type ChatState } from "@/services/chat/chatStore";
import { getDeviceToken } from "@/services/chat/deviceCheck";
import { reportChatAnswer } from "@/services/reports";

const MAX_QUESTION = 1000;
const MAX_ANSWER = 4000;
const HISTORY_LIMIT = 20;

type LiveState = ChatState & { generation: number };

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// Only complete exchanges go back to the model: a failed question or a notice has no answer to pair with.
// Clamped to the server's limits, since one over-long stored answer would make every later request fail with 400.
function historyBefore(messages: ChatMessage[], index: number): ChatTurn[] {
  return messages
    .slice(0, index)
    .filter((m) => m.status !== "failed" && !m.notice)
    .slice(-HISTORY_LIMIT)
    .map(({ role, text }) => ({ role, text: text.slice(0, role === "user" ? MAX_QUESTION : MAX_ANSWER) }));
}

function replyMessage(reply: ChatReply): ChatMessage {
  const base = { id: newId(), createdAt: Date.now() };
  if (reply.kind === "answer") {
    return { ...base, role: "assistant", text: reply.answer, citations: reply.citations, scholarLink: reply.scholarLink };
  }
  return { ...base, role: "assistant", text: "", notice: reply.kind };
}

// Module-level so a chat screen remounted while a reply is in flight waits for it, instead of reading storage before it is saved.
let pendingSend: Promise<void> | null = null;

export function useChat() {
  const chatRef = useRef<LiveState>({ messages: [], summary: null, generation: chatGeneration() });
  const loaded = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allowance, setAllowance] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resetsAt, setResetsAt] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const applyAllowance = useCallback(
    (a: { allowance: number | null; remaining: number | null; resetsAt: string | null }) => {
      setAllowance(a.allowance);
      setRemaining(a.remaining);
      setResetsAt(a.resetsAt);
    },
    [],
  );

  // After a clear (sign-out) the in-memory copy predates it: drop it so nothing old is written back.
  const liveState = useCallback(() => {
    const generation = chatGeneration();
    if (chatRef.current.generation !== generation) {
      chatRef.current = { messages: [], summary: null, generation };
      setMessages([]);
    }
    return chatRef.current;
  }, []);

  const write = useCallback((next: ChatMessage[], summary = chatRef.current.summary) => {
    chatRef.current = { ...chatRef.current, messages: next, summary };
    setMessages(next);
    void saveChat({ messages: next, summary });
  }, []);

  useEffect(() => {
    const generation = chatGeneration();
    const pending = pendingSend;
    if (pending) setRestoring(true);
    loaded.current = (pending ?? Promise.resolve())
      .catch(() => {})
      .then(loadChat)
      .then((state) => {
        chatRef.current = { ...state, generation };
        setMessages(state.messages);
        setRestoring(false);
      });
    getChatStatus().then(applyAllowance, () => {});
  }, [applyAllowance]);

  const deliver = useCallback(
    async (generation: number, id: string, text: string, history: ChatTurn[]) => {
      let reply: ChatReply;
      try {
        reply = await sendChat({
          message: text,
          history,
          summary: chatRef.current.summary,
          deviceToken: await getDeviceToken(),
        });
      } catch {
        if (chatGeneration() === generation) {
          write(chatRef.current.messages.map((m): ChatMessage => (m.id === id ? { ...m, status: "failed" } : m)));
        }
        return;
      }
      // A sign-out cleared the conversation while this was in flight: its reply belongs to nothing now.
      if (chatGeneration() !== generation) return;
      applyAllowance(reply);
      // A retried question is not the last one, so its reply goes straight after it.
      const current = chatRef.current.messages;
      const index = current.findIndex((m) => m.id === id);
      const next = [...current.slice(0, index + 1), replyMessage(reply), ...current.slice(index + 1)];
      if (reply.kind === "answer") write(next, reply.summary);
      else write(next);
    },
    [applyAllowance, write],
  );

  // Set busy synchronously so a second tap before the first await lands is refused. The generation is read
  // here, at the tap, so a sign-out that lands while the send waits for storage cancels it.
  const runExclusive = useCallback(async (task: (generation: number) => Promise<void>) => {
    if (busy.current) return;
    const generation = chatGeneration();
    busy.current = true;
    setSending(true);
    const run = (async () => {
      await loaded.current;
      if (chatGeneration() !== generation) return;
      await task(generation);
    })();
    pendingSend = run;
    try {
      await run;
    } finally {
      pendingSend = null;
      busy.current = false;
      setSending(false);
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim().slice(0, MAX_QUESTION);
      if (!question) return;
      await runExclusive(async (generation) => {
        const { messages: current } = liveState();
        const message: ChatMessage = { id: newId(), role: "user", text: question, createdAt: Date.now() };
        const history = historyBefore(current, current.length);
        write([...current, message]);
        await deliver(generation, message.id, question, history);
      });
    },
    [deliver, liveState, runExclusive, write],
  );

  const retry = useCallback(
    async (id: string) => {
      await runExclusive(async (generation) => {
        const current = liveState().messages;
        const index = current.findIndex((m) => m.id === id && m.status === "failed");
        if (index < 0) return;
        const { status: _cleared, ...rest } = current[index];
        const history = historyBefore(current, index);
        write(current.map((m, i) => (i === index ? rest : m)));
        await deliver(generation, id, rest.text, history);
      });
    },
    [deliver, liveState, runExclusive, write],
  );

  // Rejects rather than resolving, so the screen never reports a thank-you for a report that was not sent.
  const report = useCallback(
    async (id: string) => {
      const current = liveState().messages;
      const index = current.findIndex((m) => m.id === id);
      const answer = current[index];
      if (!answer || answer.role !== "assistant" || answer.notice) throw new Error("nothing to report");
      const question = current.slice(0, index).reverse().find((m) => m.role === "user");
      if (!question) throw new Error("nothing to report");
      const citationIds = (answer.citations ?? []).flatMap((c): string[] => {
        if (c.kind === "quran") return [`q:${c.surah}:${c.ayah}`];
        if (c.kind === "hadith") return [`h:${c.id}`];
        if (c.kind === "dua") return [`d:${c.id}`];
        return [];
      });
      await reportChatAnswer(question.text.slice(0, MAX_QUESTION), answer.text, citationIds);
    },
    [liveState],
  );

  return { messages, remaining, allowance, resetsAt, sending: sending || restoring, send, retry, report };
}
