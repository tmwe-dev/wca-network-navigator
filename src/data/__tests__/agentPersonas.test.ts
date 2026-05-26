/**
 * DAL — agent_personas module tests
 * Tests: findAgentPersonas, getAgentPersonaByAgent, updateAgentPersona, upsertAgentPersona
 * + seed data validation for Sprint E personas
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

const mockGetSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    auth: { getSession: () => mockGetSession() },
  },
}));

import {
  findAgentPersonas,
  getAgentPersonaByAgent,
  updateAgentPersona,
  upsertAgentPersona,
} from "@/data/agentPersonas";

import { PERSONAS_SEED } from "@/data/seeds/personasSeed";

describe("DAL — agentPersonas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      upsert: mockUpsert,
    });
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
      await expect(updateAgentPersona("p1", { tone: "casual" })).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith("agent_personas");
      expect(mockUpdate).toHaveBeenCalledWith({ tone: "casual" });
      expect(mockEq).toHaveBeenCalledWith("id", "p1");
    });

    it("throws on supabase error", async () => {
      mockEq.mockResolvedValue({ error: { message: "update denied" } });
      await expect(updateAgentPersona("p1", { tone: "casual" })).rejects.toEqual({ message: "update denied" });
    });
  });

  describe("upsertAgentPersona", () => {
    it("upserts with authenticated user", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: "user-123" } } },
      });
      mockUpsert.mockResolvedValue({ error: null });

      await upsertAgentPersona({
        agent_id: "a1",
        tone: "formal",
        language: "it",
        style_rules: ["rule1"],
        vocabulary_do: ["do1"],
        vocabulary_dont: ["dont1"],
      });

      expect(mockFrom).toHaveBeenCalledWith("agent_personas");
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ agent_id: "a1", user_id: "user-123" }), {
        onConflict: "agent_id",
      });
    });

    it("throws when not authenticated", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      });

      await expect(
        upsertAgentPersona({
          agent_id: "a1",
          tone: "formal",
          language: "it",
          style_rules: [],
          vocabulary_do: [],
          vocabulary_dont: [],
        }),
      ).rejects.toThrow("Non autenticato");
    });

    it("throws on supabase upsert error", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: "user-123" } } },
      });
      mockUpsert.mockResolvedValue({ error: { message: "upsert failed" } });

      await expect(
        upsertAgentPersona({
          agent_id: "a1",
          tone: "formal",
          language: "it",
          style_rules: [],
          vocabulary_do: [],
          vocabulary_dont: [],
        }),
      ).rejects.toEqual({ message: "upsert failed" });
    });
  });
});

describe("Sprint E — Personas seed data validation", () => {
  it("exports exactly 8 personas", () => {
    expect(PERSONAS_SEED).toHaveLength(8);
  });

  it("includes all required persona names", () => {
    const names = PERSONAS_SEED.map((p) => p.agent_name);
    expect(names).toEqual(
      expect.arrayContaining(["LUCA", "Sherlock", "Aurora", "Bruce", "Nova", "Iris", "Marco", "Sofia"]),
    );
  });

  it("every active persona has custom_tone_prompt >= 300 characters", () => {
    for (const p of PERSONAS_SEED) {
      if (p.is_active) {
        expect(p.custom_tone_prompt.length).toBeGreaterThanOrEqual(300);
      }
    }
  });

  it("every persona has a valid UUID id", () => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    for (const p of PERSONAS_SEED) {
      expect(p.id).toMatch(uuidRe);
      expect(p.agent_id).toMatch(uuidRe);
    }
  });

  it("every persona has non-empty style_rules, vocabulary_do, vocabulary_dont", () => {
    for (const p of PERSONAS_SEED) {
      expect(p.style_rules.length).toBeGreaterThan(0);
      expect(p.vocabulary_do.length).toBeGreaterThan(0);
      expect(p.vocabulary_dont.length).toBeGreaterThan(0);
    }
  });

  it("all persona ids are unique", () => {
    const ids = PERSONAS_SEED.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all agent_ids are unique", () => {
    const agentIds = PERSONAS_SEED.map((p) => p.agent_id);
    expect(new Set(agentIds).size).toBe(agentIds.length);
  });
});
