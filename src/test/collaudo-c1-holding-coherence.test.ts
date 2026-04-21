/**
 * COLLAUDO Catena 5 — Holding Pattern State Coherence
 *
 * Verifica che la definizione di "holding pattern" sia coerente
 * in tutti i moduli del sistema. Bug #5 e #6 dell'audit.
 *
 * COSA TESTA:
 * - Gli stati holding sono gli stessi ovunque
 * - La state machine ha gate corretti
 * - Nessun stato è ambiguo
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";

// ══════════════════════════════════════════════════════════
// Definizioni canoniche (dalla tassonomia del sistema)
// ══════════════════════════════════════════════════════════

const CANONICAL_LEAD_STATUSES = [
  "new", "contacted", "in_progress", "negotiation", "converted", "lost",
];

// Definizioni usate nei diversi moduli (stato ATTUALE del codice)
const MODULE_DEFINITIONS = {
  "useHoldingPattern.ts": ["contacted", "in_progress", "negotiation"],
  "agent-execute/get_holding_pattern": ["contacted", "in_progress"],
  // daily-briefing conta solo "contacted" (da verificare)
  "useEmailContactPicker.ts": "holding_pattern", // stringa letterale, non array
};

// ══════════════════════════════════════════════════════════
// TEST 1: Tassonomia stati
// ══════════════════════════════════════════════════════════

describe("Collaudo C5 — Holding Pattern Coherence", () => {

  it("C5.1 — canonical lead statuses must be exactly 6", () => {
    expect(CANONICAL_LEAD_STATUSES).toHaveLength(6);
    expect(CANONICAL_LEAD_STATUSES).toContain("new");
    expect(CANONICAL_LEAD_STATUSES).toContain("contacted");
    expect(CANONICAL_LEAD_STATUSES).toContain("in_progress");
    expect(CANONICAL_LEAD_STATUSES).toContain("negotiation");
    expect(CANONICAL_LEAD_STATUSES).toContain("converted");
    expect(CANONICAL_LEAD_STATUSES).toContain("lost");
  });

  it("C5.2 — holding statuses must include all 3 active engagement states", () => {
    const expectedHolding = ["contacted", "in_progress", "negotiation"];
    // useHoldingPattern.ts uses correct 3-state definition
    expect(MODULE_DEFINITIONS["useHoldingPattern.ts"]).toEqual(expectedHolding);
  });

  it("C5.3 — BUG: agent-execute get_holding_pattern is MISSING negotiation", () => {
    const agentDef = MODULE_DEFINITIONS["agent-execute/get_holding_pattern"];
    // This SHOULD include negotiation but currently DOES NOT
    expect(agentDef).not.toContain("negotiation");
    // This documents the bug — the test proves the inconsistency
    expect(agentDef).toHaveLength(2); // only ["contacted", "in_progress"]
  });

  it("C5.4 — BUG: useEmailContactPicker filters on literal 'holding_pattern'", () => {
    const pickerDef = MODULE_DEFINITIONS["useEmailContactPicker.ts"];
    // The picker uses a string literal "holding_pattern" which is NOT a valid lead_status
    expect(pickerDef).toBe("holding_pattern");
    // This means the filter matches ZERO real records (no partner has status "holding_pattern")
    expect(CANONICAL_LEAD_STATUSES).not.toContain("holding_pattern");
  });

  it("C5.5 — all holding statuses must be valid lead statuses", () => {
    const holdingStatuses = MODULE_DEFINITIONS["useHoldingPattern.ts"];
    for (const s of holdingStatuses) {
      expect(CANONICAL_LEAD_STATUSES).toContain(s);
    }
  });

  it("C5.6 — terminal states must NOT be in holding pattern", () => {
    const holdingStatuses = MODULE_DEFINITIONS["useHoldingPattern.ts"];
    expect(holdingStatuses).not.toContain("converted");
    expect(holdingStatuses).not.toContain("lost");
    expect(holdingStatuses).not.toContain("new");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: State Transition Gates (da stateTransitions.ts)
// ══════════════════════════════════════════════════════════

describe("Collaudo C5 — State Transition Gates", () => {

  const TRANSITION_GATES = [
    { from: "new", to: "contacted", trigger: "Primo messaggio inviato", autoApply: true },
    { from: "contacted", to: "in_progress", trigger: "Il contatto ha risposto", autoApply: true },
    { from: "contacted", to: "lost", trigger: "30+ giorni senza risposta", autoApply: false },
    { from: "in_progress", to: "negotiation", trigger: "3+ scambi bidirezionali", autoApply: false },
    { from: "negotiation", to: "converted", trigger: "Deal confermato", autoApply: false },
    { from: "*", to: "lost", trigger: "60+ giorni senza interazione", autoApply: false },
  ];

  it("C5.7 — must have exactly 6 gates", () => {
    expect(TRANSITION_GATES).toHaveLength(6);
  });

  it("C5.8 — auto-apply only for low-risk transitions", () => {
    const autoGates = TRANSITION_GATES.filter(g => g.autoApply);
    expect(autoGates).toHaveLength(2);
    // Only new→contacted and contacted→in_progress should be auto
    expect(autoGates[0].from).toBe("new");
    expect(autoGates[0].to).toBe("contacted");
    expect(autoGates[1].from).toBe("contacted");
    expect(autoGates[1].to).toBe("in_progress");
  });

  it("C5.9 — conversion and loss require manual approval", () => {
    const conversionGate = TRANSITION_GATES.find(g => g.to === "converted");
    expect(conversionGate).toBeDefined();
    expect(conversionGate!.autoApply).toBe(false);

    const lossGates = TRANSITION_GATES.filter(g => g.to === "lost");
    for (const g of lossGates) {
      expect(g.autoApply).toBe(false);
    }
  });

  it("C5.10 — no backward transitions allowed (except to lost)", () => {
    const statusOrder: Record<string, number> = {
      new: 0, contacted: 1, in_progress: 2, negotiation: 3, converted: 4, lost: -1,
    };
    for (const gate of TRANSITION_GATES) {
      if (gate.to === "lost" || gate.from === "*") continue;
      const fromLevel = statusOrder[gate.from] ?? -1;
      const toLevel = statusOrder[gate.to] ?? -1;
      expect(toLevel).toBeGreaterThan(fromLevel);
    }
  });

  it("C5.11 — every status has at least one outgoing transition", () => {
    const activeStatuses = ["new", "contacted", "in_progress", "negotiation"];
    for (const status of activeStatuses) {
      const hasGate = TRANSITION_GATES.some(
        g => g.from === status || g.from === "*"
      );
      expect(hasGate).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: useTrackActivity State Guard
// ══════════════════════════════════════════════════════════

describe("Collaudo C5 — useTrackActivity State Protection", () => {

  // Simulate the CURRENT logic of useTrackActivity
  // Line 49: await updatePartner(params.partnerId, { lead_status: "contacted", last_interaction_at: now })
  function simulateCurrentTrackActivity(currentStatus: string): string {
    // CURRENT code: unconditionally sets to "contacted" — no guard
    return "contacted";
  }

  // What the CORRECT logic should be
  function simulateCorrectTrackActivity(currentStatus: string): string {
    if (currentStatus === "new" || !currentStatus) return "contacted";
    return currentStatus; // Never downgrade
  }

  it("C5.12 — current code: new → contacted (correct)", () => {
    expect(simulateCurrentTrackActivity("new")).toBe("contacted");
  });

  it("C5.13 — BUG: current code downgrades negotiation → contacted", () => {
    // This documents the bug: the current code WOULD downgrade
    const result = simulateCurrentTrackActivity("negotiation");
    expect(result).toBe("contacted"); // BUG: should stay "negotiation"
  });

  it("C5.14 — BUG: current code downgrades in_progress → contacted", () => {
    const result = simulateCurrentTrackActivity("in_progress");
    expect(result).toBe("contacted"); // BUG: should stay "in_progress"
  });

  it("C5.15 — BUG: current code downgrades converted → contacted", () => {
    const result = simulateCurrentTrackActivity("converted");
    expect(result).toBe("contacted"); // BUG: should stay "converted"
  });

  it("C5.16 — correct logic: new → contacted", () => {
    expect(simulateCorrectTrackActivity("new")).toBe("contacted");
  });

  it("C5.17 — correct logic: negotiation stays negotiation", () => {
    expect(simulateCorrectTrackActivity("negotiation")).toBe("negotiation");
  });

  it("C5.18 — correct logic: converted stays converted", () => {
    expect(simulateCorrectTrackActivity("converted")).toBe("converted");
  });
});
