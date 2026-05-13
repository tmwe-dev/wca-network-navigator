/**
 * DAL — agent_personas module tests
 * Tests: findAgentPersonas, getAgentPersonaByAgent, updateAgentPersona
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  findAgentPersonas,
  getAgentPersonaByAgent,
  updateAgentPersona,
} from "@/data/agentPersonas";

describe("DAL — agentPersonas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  describe("findAgentPersonas", () => {
    it("returns array of personas on success", async () => {
      const personas = [
        { id: "p1", user_id: "u1", agent_id: "a1", tone: "formal" },
        { id: "p2", user_id: "u1", agent_id: "a2", tone: "casual" },
      ];
      mockEq.mockResolvedValue({ data: personas, error: null });
      const result = await findAgentPersonas("u1");
      expect(mockFrom).toHaveBeenCalledWith("agent_personas");
      expect(mockEq).toHaveBeenCalledWith("user_id", "u1");
      expect(result).toEqual(personas);
    });

    it("returns empty array when data is null", async () => {
      mockEq.mockResolvedValue({ data: null, error: null });
      const result = await findAgentPersonas("u1");
      expect(result).toEqual([]);
    });

    it("throws on supabase error", async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: "connection failed" },
      });
      await expect(findAgentPersonas("u1")).rejects.toEqual({
        message: "connection failed",
      });
    });
  });

  describe("getAgentPersonaByAgent", () => {
    it("returns persona when found", async () => {
      const persona = { id: "p1", agent_id: "a1", tone: "friendly" };
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: persona, error: null });
      const result = await getAgentPersonaByAgent("a1");
      expect(mockFrom).toHaveBeenCalledWith("agent_personas");
      expect(mockEq).toHaveBeenCalledWith("agent_id", "a1");
      expect(result).toEqual(persona);
    });

    it("returns null when no persona exists", async () => {
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getAgentPersonaByAgent("a1");
      expect(result).toBeNull();
    });

    it("throws on supabase error", async () => {
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "not found" },
      });
      await expect(getAgentPersonaByAgent("a1")).rejects.toEqual({
        message: "not found",
      });
    });
  });

  describe("updateAgentPersona", () => {
    it("resolves on success", async () => {
      mockEq.mockResolvedValue({ error: null });
      await expect(
        updateAgentPersona("p1", { tone: "casual" })
      ).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith("agent_personas");
      expect(mockUpdate).toHaveBeenCalledWith({ tone: "casual" });
      expect(mockEq).toHaveBeenCalledWith("id", "p1");
    });

    it("throws on supabase error", async () => {
      mockEq.mockResolvedValue({ error: { message: "update denied" } });
      await expect(
        updateAgentPersona("p1", { tone: "casual" })
      ).rejects.toEqual({ message: "update denied" });
    });
  });
});
