import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { countCompletedAgentTasks, findAgentTasksByUser } from "@/data/agentTasks";

describe("DAL — agentTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ in: mockIn, count: 5, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
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
      mockIn.mockResolvedValue({ data: tasks, error: null });
      const result = await findAgentTasksByUser("u1", ["pending", "approved"]);
      expect(mockFrom).toHaveBeenCalledWith("agent_tasks");
      expect(result).toEqual(tasks);
    });

    it("returns empty array when null", async () => {
      mockIn.mockResolvedValue({ data: null, error: null });
      const result = await findAgentTasksByUser("u1", ["pending"]);
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockIn.mockResolvedValue({ data: null, error: { message: "denied" } });
      await expect(findAgentTasksByUser("u1", ["x"])).rejects.toEqual({ message: "denied" });
    });
  });
});
