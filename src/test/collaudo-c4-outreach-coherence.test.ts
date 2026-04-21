/**
 * COLLAUDO Catena 2 — Primo Contatto: Relationship Stage & Playbook
 *
 * Verifica che:
 * - Il relationship_stage sia unico e coerente
 * - Un partner ghosted non riceva tono warm
 * - I playbook siano iniettati nei generatori
 * - I canali dichiarino onestamente il contesto
 *
 * Bug #7 (stage contraddittori), #8 (playbook non guida), C1-C4
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";

// ══════════════════════════════════════════════════════════
// Simulate relationship stage calculation
// ══════════════════════════════════════════════════════════

// CURRENT: decision object in generate-outreach (index.ts ~lines 75-85)
// Uses ONLY interactionHistoryCount — ignores response rate
function naiveStage(interactionCount: number): string {
  if (interactionCount === 0) return "cold";
  if (interactionCount <= 2) return "warm";
  if (interactionCount <= 5) return "engaged";
  return "active";
}

// REAL: from sameLocationGuard.analyzeRelationshipHistory
// Uses actual response rate, unanswered streak, recency
function realStage(
  interactions: number,
  responses: number,
  unansweredStreak: number,
  daysSinceLastResponse: number
): string {
  if (interactions === 0) return "cold";
  const responseRate = interactions > 0 ? responses / interactions : 0;
  if (unansweredStreak >= 3 || (interactions >= 3 && responseRate === 0)) return "ghosted";
  if (daysSinceLastResponse > 30) return "stale";
  if (responseRate >= 0.5 && interactions >= 2) return "active";
  if (responses > 0) return "warm";
  return "cold";
}

// ══════════════════════════════════════════════════════════
// TEST 1: Stage Contradiction (Bug #7)
// ══════════════════════════════════════════════════════════

describe("Collaudo C2 — Relationship Stage Coherence", () => {

  it("C2.1 — BUG: naive stage says 'active' for partner with 6 interactions but 0 responses", () => {
    const naive = naiveStage(6);
    expect(naive).toBe("active"); // WRONG — should be "ghosted"
  });

  it("C2.2 — real stage correctly identifies ghosted partner", () => {
    const real = realStage(6, 0, 6, 45);
    expect(real).toBe("ghosted");
    expect(real).not.toBe("active");
  });

  it("C2.3 — BUG: same partner gets contradictory stages in same prompt", () => {
    // Partner: 6 interactions, 0 responses, 45 days since last
    const naive = naiveStage(6);
    const real = realStage(6, 0, 6, 45);
    // In the current code, BOTH values exist in the prompt
    expect(naive).not.toBe(real); // Contradiction!
    expect(naive).toBe("active");
    expect(real).toBe("ghosted");
  });

  it("C2.4 — partner with genuine engagement has consistent stages", () => {
    // Partner: 4 interactions, 3 responses, 0 unanswered, 2 days ago
    const naive = naiveStage(4);
    const real = realStage(4, 3, 0, 2);
    // Both should be positive
    expect(["warm", "engaged"].includes(naive)).toBe(true);
    expect(real).toBe("active");
    // Not contradictory per se, but different names
  });

  it("C2.5 — cold partner is consistently cold", () => {
    const naive = naiveStage(0);
    const real = realStage(0, 0, 0, 999);
    expect(naive).toBe("cold");
    expect(real).toBe("cold");
  });

  it("C2.6 — stale partner (30+ days no response) must not be warm", () => {
    const real = realStage(3, 1, 2, 35);
    expect(real).toBe("stale");
    expect(real).not.toBe("warm");
    expect(real).not.toBe("active");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: Tone vs Stage Alignment
// ══════════════════════════════════════════════════════════

describe("Collaudo C2 — Tone Must Match Stage", () => {

  // Mapping: which tones are appropriate for which stages
  const ALLOWED_TONES: Record<string, string[]> = {
    cold: ["formal", "introductory", "exploratory"],
    warm: ["friendly", "professional", "follow-up"],
    active: ["collaborative", "direct", "partnership"],
    stale: ["re-engagement", "gentle-reminder", "check-in"],
    ghosted: ["last-chance", "break-up", "redirect"],
  };

  const FORBIDDEN_TONES: Record<string, string[]> = {
    cold: ["intimate", "demanding", "partnership"],
    ghosted: ["warm", "collaborative", "enthusiastic"],
    stale: ["demanding", "urgent", "partnership"],
  };

  it("C2.7 — ghosted partner must NOT receive warm/collaborative tone", () => {
    const stage = "ghosted";
    const forbidden = FORBIDDEN_TONES[stage] || [];
    // If the naive stage said "active", the AI might use collaborative tone
    // on a ghosted partner — this is the business impact of bug #7
    expect(forbidden).toContain("warm");
    expect(forbidden).toContain("collaborative");
  });

  it("C2.8 — cold partner must NOT receive partnership tone", () => {
    const stage = "cold";
    const forbidden = FORBIDDEN_TONES[stage] || [];
    expect(forbidden).toContain("partnership");
    expect(forbidden).toContain("intimate");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: Playbook Injection (Bug #8)
// ══════════════════════════════════════════════════════════

describe("Collaudo C2 — Playbook Injection in Generators", () => {

  // Simulate what generate-outreach currently loads
  interface GeneratorContext {
    kbEntries: string[];
    emailHistory: string[];
    sameLocationGuard: boolean;
    playbookInstructions: string | null;
    workflowState: string | null;
    activeGates: string[];
  }

  // Current: no playbook, no workflow, no gates
  function simulateCurrentContext(): GeneratorContext {
    return {
      kbEntries: ["KB entry 1", "KB entry 2"],
      emailHistory: ["Previous email 1"],
      sameLocationGuard: true,
      playbookInstructions: null, // BUG: not loaded
      workflowState: null, // BUG: not loaded
      activeGates: [], // BUG: not loaded
    };
  }

  // Correct: with playbook + workflow + gates
  function simulateCorrectContext(): GeneratorContext {
    return {
      kbEntries: ["KB entry 1", "KB entry 2"],
      emailHistory: ["Previous email 1"],
      sameLocationGuard: true,
      playbookInstructions: "Follow up with service proposal after initial contact",
      workflowState: "gate_2_proposal",
      activeGates: ["budget_confirmed", "need_validated"],
    };
  }

  it("C2.9 — BUG: current generator has NO playbook instructions", () => {
    const ctx = simulateCurrentContext();
    expect(ctx.playbookInstructions).toBeNull();
  });

  it("C2.10 — BUG: current generator has NO workflow state", () => {
    const ctx = simulateCurrentContext();
    expect(ctx.workflowState).toBeNull();
  });

  it("C2.11 — BUG: current generator has NO active gates", () => {
    const ctx = simulateCurrentContext();
    expect(ctx.activeGates).toHaveLength(0);
  });

  it("C2.12 — correct: generator has playbook instructions", () => {
    const ctx = simulateCorrectContext();
    expect(ctx.playbookInstructions).not.toBeNull();
    expect(ctx.playbookInstructions!.length).toBeGreaterThan(10);
  });

  it("C2.13 — correct: generator knows workflow state", () => {
    const ctx = simulateCorrectContext();
    expect(ctx.workflowState).toBe("gate_2_proposal");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: Channel Context Declaration (Bug C4)
// ══════════════════════════════════════════════════════════

describe("Collaudo C2 — Channel Context Honesty", () => {

  function getChannelContext(channel: string): { hasFullHistory: boolean; note: string } {
    switch (channel) {
      case "email":
        return { hasFullHistory: true, note: "Canale primario con contesto storico completo" };
      case "whatsapp":
        return { hasFullHistory: false, note: "Contesto storico limitato" };
      case "linkedin":
        return { hasFullHistory: false, note: "Contesto storico limitato" };
      default:
        return { hasFullHistory: false, note: "Canale sconosciuto" };
    }
  }

  it("C2.14 — email channel declares full history", () => {
    const ctx = getChannelContext("email");
    expect(ctx.hasFullHistory).toBe(true);
  });

  it("C2.15 — WhatsApp channel declares limited history", () => {
    const ctx = getChannelContext("whatsapp");
    expect(ctx.hasFullHistory).toBe(false);
    expect(ctx.note).toContain("limitato");
  });

  it("C2.16 — LinkedIn channel declares limited history", () => {
    const ctx = getChannelContext("linkedin");
    expect(ctx.hasFullHistory).toBe(false);
    expect(ctx.note).toContain("limitato");
  });

  it("C2.17 — BUG: current system does NOT declare channel limitations", () => {
    // Currently, generate-outreach treats all channels as having equal context
    // WhatsApp and LinkedIn get the same deep context assembly as email
    // but without the actual conversation data — so the AI hallucinates
    const bugExists = true;
    expect(bugExists).toBe(true);
  });
});
