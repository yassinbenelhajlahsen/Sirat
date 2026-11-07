const mockApiPost = jest.fn();
jest.mock("@/services/apiClient", () => ({ apiPost: (...args: unknown[]) => mockApiPost(...args) }));

import { reportChatAnswer, reportDuaMatch } from "@/services/reports";

it("wrong-dua report posts only the request and dua id", async () => {
  mockApiPost.mockResolvedValue({ id: "rep_1" });
  await reportDuaMatch("  help with exams  ", 42);
  expect(mockApiPost).toHaveBeenCalledWith("/api/reports", {
    kind: "dua",
    input: "help with exams",
    output: { duaId: 42 },
  });
});

it("chat report posts the trimmed question with the answer and its citation ids", async () => {
  mockApiPost.mockResolvedValue({ id: "rep_2" });
  await reportChatAnswer("  q  ", "a", ["q:2:275"]);
  expect(mockApiPost).toHaveBeenCalledWith("/api/reports", {
    kind: "chat",
    input: "q",
    output: { answer: "a", citationIds: ["q:2:275"] },
  });
});
