const mockApiPost = jest.fn();
jest.mock("@/services/apiClient", () => ({ apiPost: (...args: unknown[]) => mockApiPost(...args) }));

import { reportDuaMatch } from "@/services/reports";

it("wrong-dua report posts only the request and dua id", async () => {
  mockApiPost.mockResolvedValue({ id: "rep_1" });
  await reportDuaMatch("  help with exams  ", 42);
  expect(mockApiPost).toHaveBeenCalledWith("/api/reports", {
    kind: "dua",
    input: "help with exams",
    output: { duaId: 42 },
  });
});
