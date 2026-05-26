/**
 * DAL — agents module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import {
  findAgents,
  findActiveAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  countActiveAgents,
  invalidateAgents,
} from "@/data/agents";

describe("DAL — agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default chain: from -> select -> order/eq/etc
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });
  });

  describe("findAgents", () => {
    it("returns all agents ordered by created_at desc", async () => {
      const agents = [{ id: "a1", name: "Agent 1" }];
      mockSelect.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue({ data: agents, error: null });
      const result = await findAgents();
      expect(mockFrom).toHaveBeenCalledWith("agents");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(result).toEqual(agents);
    });

    it("throws on error", async () => {
      mockSelect.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(findAgents()).rejects.toEqual({ message: "fail" });
    });

    it("returns empty array when data is null", async () => {
      mockSelect.mockReturnValue({ order: mockOrder });
      mockOrder.mockResolvedValue({ data: null, error: null });
      const result = await findAgents();
      expect(result).toEqual([]);
    });
  });

  describe("findActiveAgents", () => {
    it("returns active agents with specified fields", async () => {
      const active = [{ name: "Bot", is_active: true }];
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockResolvedValue({ data: active, error: null });
      const result = await findActiveAgents();
      expect(mockEq).toHaveBeenCalledWith("is_active", true);
      expect(result).toEqual(active);
    });

    it("throws on error", async () => {
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockResolvedValue({ data: null, error: { message: "denied" } });
      await expect(findActiveAgents()).rejects.toEqual({ message: "denied" });
    });
  });

  describe("getAgentById", () => {
    it("returns a single agent", async () => {
      const agent = { id: "a1", name: "Agent 1" };
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: agent, error: null });
      const result = await getAgentById("a1");
      expect(mockEq).toHaveBeenCalledWith("id", "a1");
      expect(result).toEqual(agent);
    });

    it("returns null when not found", async () => {
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getAgentById("missing");
      expect(result).toBeNull();
    });

    it("throws on error", async () => {
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "bad" } });
      await expect(getAgentById("a1")).rejects.toEqual({ message: "bad" });
    });
  });

  describe("createAgent", () => {
    it("inserts and returns the created agent", async () => {
      const agent = { id: "a1", name: "New Agent" };
      mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
      mockSingle.mockResolvedValue({ data: agent, error: null });
      const result = await createAgent({ name: "New Agent" } as any);
      expect(mockFrom).toHaveBeenCalledWith("agents");
      expect(result).toEqual(agent);
    });

    it("throws on insert error", async () => {
      mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
      mockSingle.mockResolvedValue({ data: null, error: { message: "dup" } });
      await expect(createAgent({ name: "Dup" } as any)).rejects.toEqual({ message: "dup" });
    });
  });

  describe("deleteAgent", () => {
    it("deletes by id", async () => {
      mockDelete.mockReturnValue({ eq: mockEq });
      mockEq.mockResolvedValue({ error: null });
      await deleteAgent("a1");
      expect(mockEq).toHaveBeenCalledWith("id", "a1");
    });

    it("throws on error", async () => {
      mockDelete.mockReturnValue({ eq: mockEq });
      mockEq.mockResolvedValue({ error: { message: "fk constraint" } });
      await expect(deleteAgent("a1")).rejects.toEqual({ message: "fk constraint" });
    });
  });

  describe("invalidateAgents", () => {
    it("calls invalidateQueries with correct key", () => {
      const mockQc = { invalidateQueries: vi.fn() };
      invalidateAgents(mockQc as any);
      expect(mockQc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["agents"] });
    });
  });
});
