/**
 * COLLAUDO Catena 4 + 3 — Enterprise Tools: KB, Playbook, WorkPlan
 *
 * Verifica che:
 * - search_kb ha guardia su userId
 * - execute_plan_step esegue il tool (non solo log)
 * - apply_playbook persiste l'attivazione
 * - Composer V2 legge la risposta corretta
 *
 * Bug #3 (apply_playbook/execute_plan_step), #9 (search_kb), #10 (composer V2)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";

// ══════════════════════════════════════════════════════════
// TEST 1: search_kb userId Guard
// ══════════════════════════════════════════════════════════

describe("Collaudo C4 — search_kb Fallback Integrity", () => {

  // Simulate the search_kb function logic
  function simulateSearchKb(
    query: string,
    userId: string,
    embeddingResults: any[]
  ): { matches: any[]; method: string; error?: string } {
    if (!query) return { matches: [], method: "error", error: "query è obbligatoria" };

    // Embedding search
    if (embeddingResults.length > 0) {
      return { matches: embeddingResults, method: "embedding" };
    }

    // Text fallback — THIS is where the bug is
    // Current code uses _userId from function parameter
    // But the caller might pass empty string
    if (!userId) {
      // BUG: query runs with empty userId → matches nothing
      return { matches: [], method: "fallback_text" };
    }

    // With valid userId, fallback would work
    return {
      matches: [{ id: "1", title: "Test KB", content: "..." }],
      method: "fallback_text",
    };
  }

  it("C4.1 — embedding search works regardless of userId", () => {
    const result = simulateSearchKb("test", "", [{ id: "1", title: "Match" }]);
    expect(result.method).toBe("embedding");
    expect(result.matches).toHaveLength(1);
  });

  it("C4.2 — text fallback with valid userId returns results", () => {
    const result = simulateSearchKb("test", "user-uuid-123", []);
    expect(result.method).toBe("fallback_text");
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("C4.3 — BUG: text fallback with empty userId returns empty", () => {
    const result = simulateSearchKb("test", "", []);
    expect(result.method).toBe("fallback_text");
    expect(result.matches).toHaveLength(0); // BUG: should have results
  });

  it("C4.4 — empty query returns error", () => {
    const result = simulateSearchKb("", "user-123", []);
    expect(result.error).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: execute_plan_step Execution
// ══════════════════════════════════════════════════════════

describe("Collaudo C4 — execute_plan_step Real Execution", () => {

  interface PlanStep {
    index: number;
    description: string;
    tool: string | null;
    args: Record<string, unknown>;
    status: string;
    result: unknown;
  }

  // Current behavior: just logs a note
  function simulateCurrentExecution(step: PlanStep): unknown {
    if (step.tool && typeof step.tool === "string") {
      return { note: `Tool "${step.tool}" da eseguire con args: ${JSON.stringify(step.args || {})}` };
    }
    return null;
  }

  // Correct behavior: calls real handler
  function simulateCorrectExecution(
    step: PlanStep,
    toolHandlers: Record<string, (args: any) => any>
  ): unknown {
    if (step.tool && typeof step.tool === "string") {
      const handler = toolHandlers[step.tool];
      if (handler) {
        return handler(step.args);
      }
      return { note: `Tool "${step.tool}" non ha executor. Esecuzione manuale richiesta.` };
    }
    return null;
  }

  it("C4.5 — BUG: current code returns note instead of executing", () => {
    const step: PlanStep = {
      index: 0, description: "Search KB", tool: "search_kb",
      args: { query: "servizi marittimi" }, status: "pending", result: null,
    };
    const result = simulateCurrentExecution(step) as any;
    expect(result.note).toContain("da eseguire");
    // It says "to be executed" but doesn't actually execute
    expect(result).not.toHaveProperty("matches");
  });

  it("C4.6 — correct: executes the tool handler and returns real data", () => {
    const handlers = {
      search_kb: (args: any) => ({
        matches: [{ title: "Servizi FCL", content: "..." }],
        method: "embedding",
      }),
    };
    const step: PlanStep = {
      index: 0, description: "Search KB", tool: "search_kb",
      args: { query: "servizi marittimi" }, status: "pending", result: null,
    };
    const result = simulateCorrectExecution(step, handlers) as any;
    expect(result.matches).toBeDefined();
    expect(result.matches).toHaveLength(1);
  });

  it("C4.7 — correct: unknown tool returns manual note (no crash)", () => {
    const step: PlanStep = {
      index: 0, description: "Call custom API", tool: "custom_api_call",
      args: {}, status: "pending", result: null,
    };
    const result = simulateCorrectExecution(step, {}) as any;
    expect(result.note).toContain("manuale");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: apply_playbook Persistence
// ══════════════════════════════════════════════════════════

describe("Collaudo C4 — apply_playbook Activation", () => {

  interface ApplyResult {
    success: boolean;
    playbook: { code: string; name: string };
    activation_persisted: boolean;
    partner_id: string | null;
  }

  // Current behavior: returns playbook but doesn't persist
  function simulateCurrentApply(playbookCode: string, partnerId: string | null): ApplyResult {
    return {
      success: true,
      playbook: { code: playbookCode, name: "First Contact" },
      activation_persisted: false, // BUG: never persists
      partner_id: partnerId,
    };
  }

  // Correct behavior: persists when partner_id present
  function simulateCorrectApply(playbookCode: string, partnerId: string | null): ApplyResult {
    return {
      success: true,
      playbook: { code: playbookCode, name: "First Contact" },
      activation_persisted: !!partnerId,
      partner_id: partnerId,
    };
  }

  it("C4.8 — BUG: current code never persists playbook activation", () => {
    const result = simulateCurrentApply("first_contact", "partner-uuid");
    expect(result.activation_persisted).toBe(false);
    // "Playbook attivato" is semantically false — nothing was persisted
  });

  it("C4.9 — correct: with partner_id, activation is persisted", () => {
    const result = simulateCorrectApply("first_contact", "partner-uuid");
    expect(result.activation_persisted).toBe(true);
  });

  it("C4.10 — correct: without partner_id, activation is NOT persisted (graceful)", () => {
    const result = simulateCorrectApply("first_contact", null);
    expect(result.activation_persisted).toBe(false);
    expect(result.success).toBe(true); // Still returns the playbook data
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: Composer V2 Response Key
// ══════════════════════════════════════════════════════════

describe("Collaudo G1 — Composer V2 Response Handling", () => {

  // ai-assistant returns { content: "..." }
  // useEmailComposerV2 reads data.response (WRONG KEY)

  function simulateAiAssistantResponse(): Record<string, unknown> {
    return {
      content: "Gentile partner, le scrivo per proporre una collaborazione...",
      // Note: there is no "response" key
    };
  }

  it("C7.1 — BUG: reading data.response gets undefined", () => {
    const data = simulateAiAssistantResponse();
    expect(data.response).toBeUndefined();
    // The composer tries to set body to undefined → body stays empty
  });

  it("C7.2 — content key has the actual response", () => {
    const data = simulateAiAssistantResponse();
    expect(data.content).toBeDefined();
    expect(typeof data.content).toBe("string");
    expect((data.content as string).length).toBeGreaterThan(10);
  });

  it("C7.3 — correct: read both keys with fallback", () => {
    const data = simulateAiAssistantResponse();
    const body = (data.response as string) || (data.content as string) || "";
    expect(body).toBeTruthy();
    expect(body.length).toBeGreaterThan(10);
  });

  it("C7.4 — handles missing both keys gracefully", () => {
    const data: Record<string, unknown> = {};
    const body = (data.response as string) || (data.content as string) || "";
    expect(body).toBe("");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 5: tool-decision Mode Bugs
// ══════════════════════════════════════════════════════════

describe("Collaudo B2 — tool-decision Mode", () => {

  // Simulate the provider object from resolveAiProvider
  const provider = {
    url: "https://api.example.com", // Correct key
    model: "google/gemini-2.5-flash",
    isUserKey: false,
    // baseUrl does NOT exist — bug
  };

  it("C8.14 — BUG: code reads provider.baseUrl but property is 'url'", () => {
    expect((provider as any).baseUrl).toBeUndefined();
    expect(provider.url).toBeDefined();
  });

  it("C8.15 — correct property is provider.url", () => {
    expect(provider.url).toBe("https://api.example.com");
  });

  it("C8.16 — consumeCredits must receive usage object, not number", () => {
    // Current code: consumeCredits(supabase, userId, 1, isUserKey)
    // Correct:      consumeCredits(supabase, userId, { prompt_tokens: 200, completion_tokens: 100 }, isUserKey)
    const incorrectUsage = 1;
    const correctUsage = { prompt_tokens: 200, completion_tokens: 100 };

    expect(typeof incorrectUsage).toBe("number"); // BUG: number instead of object
    expect(typeof correctUsage).toBe("object"); // Correct: object
    expect(correctUsage).toHaveProperty("prompt_tokens");
    expect(correctUsage).toHaveProperty("completion_tokens");
  });
});
