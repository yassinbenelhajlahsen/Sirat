import { apiPost } from "@/services/apiClient";

// Sent only when the user reports a wrong dua: the request they typed and the dua it matched.
export async function reportDuaMatch(request: string, duaId: number): Promise<void> {
  await apiPost("/api/reports", { kind: "dua", input: request.trim(), output: { duaId } });
}

// Sent only when the user reports a chat answer. The server stores the answer as shown, with its citation ids.
export async function reportChatAnswer(question: string, answer: string, citationIds: string[]): Promise<void> {
  await apiPost("/api/reports", { kind: "chat", input: question.trim(), output: { answer, citationIds } });
}
