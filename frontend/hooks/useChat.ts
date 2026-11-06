import { useCallback, useEffect, useRef, useState } from "react";

import { getChatStatus, sendChat, type ChatReply, type ChatTurn } from "@/services/chat/chatApi";
import { loadChat, saveChat, type ChatMessage, type ChatState } from "@/services/chat/chatStore";
import { getDeviceToken } from "@/services/chat/deviceCheck";
import { reportChatAnswer } from "@/services/reports";

const MAX_QUESTION = 1000;
const HISTORY_LIMIT = 20;

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// Only complete exchanges go back to the model: a failed question or a notice has no answer to pair with.
function historyBefore(messages: ChatMessage[], index: number): ChatTurn[] {
  return messages
    .slice(0, index)
    .filter((m) => m.status !== "failed" && !m.notice)
    .slice(-HISTORY_LIMIT)
    .map(({ role, text }) => ({ role, text }));
}

function replyMessage(reply: ChatReply): ChatMessage {
  const base = { id: newId(), createdAt: Date.now() };
  if (reply.kind === "answer") {
    return { ...base, role: "assistant", text: reply.answer, citations: reply.citations, scholarLink: reply.scholarLink };
  }
  return { ...base, role: "assistant", text: "", notice: reply.kind };
}

export function useChat() {
  const chatRef = useRef<ChatState>({ messages: [], summary: null });
  const loaded = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allowance, setAllowance] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resetsAt, setResetsAt] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const applyAllowance = useCallback(
    (a: { allowance: number | null; remaining: number | null; resetsAt: string | null }) => {
      setAllowance(a.allowance);
      setRemaining(a.remaining);
      setResetsAt(a.resetsAt);
    },
    [],
  );

  const write = useCallback((next: ChatMessage[], summary = chatRef.current.summary) => {
    chatRef.current = { messages: next, summary };
    setMessages(next);
    void saveChat(chatRef.current);
  }, []);

  useEffect(() => {
    loaded.current = loadChat().then((state) => {
      chatRef.current = state;
      setMessages(state.messages);
    });
    getChatStatus().then(applyAllowance, () => {});
  }, [applyAllowance]);

  const deliver = useCallback(
    async (id: string, text: string, history: ChatTurn[]) => {
      try {
        const reply = await sendChat({
          message: text,
          history,
          summary: chatRef.current.summary,
          deviceToken: await getDeviceToken(),
        });
        applyAllowance(reply);
        const next = [...chatRef.current.messages, replyMessage(reply)];
        if (reply.kind === "answer") write(next, reply.summary);
        else write(next);
      } catch {
        write(chatRef.current.messages.map((m): ChatMessage => (m.id === id ? { ...m, status: "failed" } : m)));
      }
    },
    [applyAllowance, write],
  );

  // Set busy synchronously so a second tap before the first await lands is refused.
  const runExclusive = useCallback(async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      await loaded.current;
      await task();
    } finally {
      busy.current = false;
      setSending(false);
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim().slice(0, MAX_QUESTION);
      if (!question) return;
      await runExclusive(async () => {
        const current = chatRef.current.messages;
        const message: ChatMessage = { id: newId(), role: "user", text: question, createdAt: Date.now() };
        const history = historyBefore(current, current.length);
        write([...current, message]);
        await deliver(message.id, question, history);
      });
    },
    [deliver, runExclusive, write],
  );

  const retry = useCallback(
    async (id: string) => {
      await runExclusive(async () => {
        const current = chatRef.current.messages;
        const index = current.findIndex((m) => m.id === id && m.status === "failed");
        if (index < 0) return;
        const { status: _cleared, ...rest } = current[index];
        const history = historyBefore(current, index);
        write(current.map((m, i) => (i === index ? rest : m)));
        await deliver(id, rest.text, history);
      });
    },
    [deliver, runExclusive, write],
  );

  const report = useCallback(async (id: string) => {
    const current = chatRef.current.messages;
    const index = current.findIndex((m) => m.id === id);
    const answer = current[index];
    if (!answer || answer.role !== "assistant" || answer.notice) return;
    const question = current.slice(0, index).reverse().find((m) => m.role === "user");
    if (!question) return;
    const citationIds = (answer.citations ?? []).map((c) =>
      c.kind === "quran" ? `q:${c.surah}:${c.ayah}` : `h:${c.id}`,
    );
    await reportChatAnswer(question.text.slice(0, MAX_QUESTION), answer.text, citationIds);
  }, []);

  return { messages, remaining, allowance, resetsAt, sending, send, retry, report };
}
