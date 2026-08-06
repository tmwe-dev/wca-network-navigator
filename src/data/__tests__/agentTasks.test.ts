import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { countCompletedAgentTasks, findAgentTasksByUser } from "@/data/agentTasks";

/** Terminal risultato query che supporta anche `.returns<T>()` come il client reale. */
function res(value: any) {
  const node: any = {
    returns: () => node,
    then: (onOk: (v: any) => void, onErr?: (e: any) => void) => Promise.resolve(value).then(onOk, onErr),
  };
  node.eq = () => node;
  node.in = () => node;
  node.order = () => node;
  node.limit = () => node;
  return node;
}

describe("DAL — agentTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ in: mockIn, count: 5, error: null });
    mockIn.mockReturnValue(res({ data: [], error: null }));
  });

  describe("countCompletedAgentTasks", () => {
    it("returns count on success", async () => {
      mockEq.mockReturnValue({ count: 42, error: null });
      const result = await countCompletedAgentTasks();
      expect(mockFrom).toHaveBeenCalledWith("agent_tasks");
      expect(result).toBe(42);
    });

    it("returns 0 when count is null", async () => {
      mockEq.mockReturnValue({ count: null, error: null });
      const result = await countCompletedAgentTasks();
      expect(result).toBe(0);
    });

    it("throws on error", async () => {
      mockEq.mockReturnValue({ count: null, error: { message: "fail" } });
      await expect(countCompletedAgentTasks()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("findAgentTasksByUser", () => {
    it("returns tasks for user", async () => {
      const tasks = [{ agent_id: "a1", status: "pending" }];
      mockIn.mockReturnValue(res({ data: tasks, error: null }));
      const result = await findAgentTasksByUser("u1", ["pending", "approved"]);
      expect(mockFrom).toHaveBeenCalledWith("agent_tasks");
      expect(result).toEqual(tasks);
    });

    it("returns empty array when null", async () => {
      mockIn.mockReturnValue(res({ data: null, error: null }));
      const result = await findAgentTasksByUser("u1", ["pending"]);
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockIn.mockReturnValue(res({ data: null, error: { message: "denied" } }));
      await expect(findAgentTasksByUser("u1", ["x"])).rejects.toEqual({ message: "denied" });
    });
  });
});
