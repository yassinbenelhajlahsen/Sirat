import { apiPost } from "@/services/apiClient";

// Sent only when the user reports a wrong dua: the request they typed and the dua it matched.
export async function reportDuaMatch(request: string, duaId: number): Promise<void> {
  await apiPost("/api/reports", { kind: "dua", input: request.trim(), output: { duaId } });
}
