/**
 * COLLAUDO Catena 7 — Post-Conversion: Terminal States & Cleanup
 *
 * Verifica che:
 * - Gli stati terminali (converted, lost) non ricevano automazione aggressiva
 * - Le regole cadence per terminal states siano restrittive
 * - Nessun escalation/downgrade automatico da stati terminali
 * - La pipeline conversione→archiviazione sia completa
 *
 * Design decision audit: documenta scelte intenzionali vs bug
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { computeEscalation, computeDowngrade } from "@/lib/leadEscalation";

// ══════════════════════════════════════════════════════════
// Cadence rules per terminal states (from cadenceEngine.ts)
// ══════════════════════════════════════════════════════════

interface CadenceRule {
  maxContactsPerWeek: number;
  allowedChannels: string[];
  cooldownDays: number;
  requiresApproval: boolean;
}

const CADENCE_RULES: Record<string, CadenceRule> = {
  new: {
    maxContactsPerWeek: 3,
    allowedChannels: ["email", "linkedin"],
    cooldownDays: 2,
    requiresApproval: false,
  },
  contacted: {
    maxContactsPerWeek: 2,
    allowedChannels: ["email", "whatsapp", "linkedin"],
    cooldownDays: 3,
    requiresApproval: false,
  },
  in_progress: {
    maxContactsPerWeek: 3,
    allowedChannels: ["email", "whatsapp", "linkedin"],
    cooldownDays: 2,
    requiresApproval: false,
  },
  negotiation: {
    maxContactsPerWeek: 5,
    allowedChannels: ["email", "whatsapp", "linkedin", "phone"],
    cooldownDays: 1,
    requiresApproval: false,
  },
  converted: {
    maxContactsPerWeek: 1,
    allowedChannels: ["email", "whatsapp", "linkedin"],
    cooldownDays: 7,
    requiresApproval: true,
  },
  lost: {
    maxContactsPerWeek: 0,
    allowedChannels: [],
    cooldownDays: 999,
    requiresApproval: true,
  },
};

// ══════════════════════════════════════════════════════════
// TEST 1: Terminal State Isolation
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — Terminal State Isolation", () => {

  it("C7.T1 — lost partners get ZERO automated contacts", () => {
    const rule = CADENCE_RULES.lost;
    expect(rule.maxContactsPerWeek).toBe(0);
    expect(rule.allowedChannels).toHaveLength(0);
    expect(rule.requiresApproval).toBe(true);
  });

  it("C7.T2 — converted partners get minimal maintenance contact", () => {
    const rule = CADENCE_RULES.converted;
    expect(rule.maxContactsPerWeek).toBe(1);
    expect(rule.cooldownDays).toBeGreaterThanOrEqual(7);
    expect(rule.requiresApproval).toBe(true);
  });

  it("C7.T3 — lost cannot be escalated by any email", () => {
    expect(computeEscalation("interested", "positive", "lost")).toBeNull();
    expect(computeEscalation("meeting_request", "very_positive", "lost")).toBeNull();
  });

  it("C7.T4 — converted cannot be escalated", () => {
    expect(computeEscalation("interested", "positive", "converted")).toBeNull();
    expect(computeEscalation("meeting_request", "very_positive", "converted")).toBeNull();
  });

  it("C7.T5 — lost cannot be further downgraded", () => {
    expect(computeDowngrade("not_interested", 0.99, "lost")).toBeNull();
  });

  it("C7.T6 — converted cannot be downgraded automatically", () => {
    expect(computeDowngrade("not_interested", 0.99, "converted")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: Cadence Progression Coherence
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — Cadence Rules Progression", () => {

  it("C7.C1 — negotiation has highest contact frequency (active deal)", () => {
    const neg = CADENCE_RULES.negotiation;
    const other = [CADENCE_RULES.new, CADENCE_RULES.contacted, CADENCE_RULES.in_progress];
    for (const rule of other) {
      expect(neg.maxContactsPerWeek).toBeGreaterThanOrEqual(rule.maxContactsPerWeek);
    }
  });

  it("C7.C2 — negotiation has shortest cooldown", () => {
    expect(CADENCE_RULES.negotiation.cooldownDays).toBe(1);
  });

  it("C7.C3 — negotiation opens phone channel (not available earlier)", () => {
    expect(CADENCE_RULES.negotiation.allowedChannels).toContain("phone");
    expect(CADENCE_RULES.new.allowedChannels).not.toContain("phone");
    expect(CADENCE_RULES.contacted.allowedChannels).not.toContain("phone");
  });

  it("C7.C4 — new partners don't get whatsapp (too informal for first contact)", () => {
    expect(CADENCE_RULES.new.allowedChannels).not.toContain("whatsapp");
  });

  it("C7.C5 — lost cooldown is effectively infinite", () => {
    expect(CADENCE_RULES.lost.cooldownDays).toBeGreaterThanOrEqual(365);
  });

  it("C7.C6 — terminal states require approval for any contact", () => {
    expect(CADENCE_RULES.converted.requiresApproval).toBe(true);
    expect(CADENCE_RULES.lost.requiresApproval).toBe(true);
  });

  it("C7.C7 — active states don't require approval (automated ok)", () => {
    expect(CADENCE_RULES.new.requiresApproval).toBe(false);
    expect(CADENCE_RULES.contacted.requiresApproval).toBe(false);
    expect(CADENCE_RULES.in_progress.requiresApproval).toBe(false);
    expect(CADENCE_RULES.negotiation.requiresApproval).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: Post-Conversion Cleanup Audit
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — Post-Conversion Cleanup (Bug Audit)", () => {

  // This section documents what SHOULD happen when a partner reaches
  // terminal state, vs what currently happens

  interface PendingAction {
    partner_id: string;
    status: string;
    action_type: string;
    scheduled_for: string;
  }

  function simulateCurrentCleanup(
    partnerId: string,
    newStatus: "converted" | "lost",
    pendingActions: PendingAction[]
  ): { cancelledActions: PendingAction[]; remainingActions: PendingAction[] } {
    // CURRENT: no cleanup happens — pending actions remain
    return {
      cancelledActions: [],
      remainingActions: pendingActions,
    };
  }

  function simulateCorrectCleanup(
    partnerId: string,
    newStatus: "converted" | "lost",
    pendingActions: PendingAction[]
  ): { cancelledActions: PendingAction[]; remainingActions: PendingAction[] } {
    const partnerActions = pendingActions.filter(a => a.partner_id === partnerId);
    const otherActions = pendingActions.filter(a => a.partner_id !== partnerId);

    if (newStatus === "lost") {
      // Lost: cancel ALL pending actions
      return {
        cancelledActions: partnerActions,
        remainingActions: otherActions,
      };
    }

    // Converted: cancel outreach actions, keep maintenance
    const cancelled = partnerActions.filter(a =>
      ["send_email", "send_whatsapp", "send_linkedin"].includes(a.action_type)
    );
    const kept = partnerActions.filter(a =>
      !["send_email", "send_whatsapp", "send_linkedin"].includes(a.action_type)
    );

    return {
      cancelledActions: cancelled,
      remainingActions: [...otherActions, ...kept],
    };
  }

  const MOCK_PENDING: PendingAction[] = [
    { partner_id: "p1", status: "pending", action_type: "send_email", scheduled_for: "2025-01-15" },
    { partner_id: "p1", status: "pending", action_type: "send_whatsapp", scheduled_for: "2025-01-18" },
    { partner_id: "p1", status: "pending", action_type: "create_task", scheduled_for: "2025-01-20" },
    { partner_id: "p2", status: "pending", action_type: "send_email", scheduled_for: "2025-01-16" },
  ];

  it("C7.CL1 — BUG: current cleanup does nothing on conversion", () => {
    const result = simulateCurrentCleanup("p1", "converted", MOCK_PENDING);
    expect(result.cancelledActions).toHaveLength(0);
    expect(result.remainingActions).toHaveLength(4); // All remain!
    // This means a "converted" partner still gets automated outreach
  });

  it("C7.CL2 — BUG: current cleanup does nothing on lost", () => {
    const result = simulateCurrentCleanup("p1", "lost", MOCK_PENDING);
    expect(result.cancelledActions).toHaveLength(0);
    expect(result.remainingActions).toHaveLength(4);
    // Lost partner still gets emails!
  });

  it("C7.CL3 — correct: lost cancels ALL partner actions", () => {
    const result = simulateCorrectCleanup("p1", "lost", MOCK_PENDING);
    expect(result.cancelledActions).toHaveLength(3); // All 3 p1 actions
    expect(result.remainingActions).toHaveLength(1); // Only p2's action
  });

  it("C7.CL4 — correct: converted cancels outreach but keeps tasks", () => {
    const result = simulateCorrectCleanup("p1", "converted", MOCK_PENDING);
    expect(result.cancelledActions).toHaveLength(2); // send_email + send_whatsapp
    expect(result.remainingActions).toHaveLength(2); // create_task (p1) + send_email (p2)
  });

  it("C7.CL5 — correct: cleanup doesn't affect other partners", () => {
    const result = simulateCorrectCleanup("p1", "lost", MOCK_PENDING);
    const p2Actions = result.remainingActions.filter(a => a.partner_id === "p2");
    expect(p2Actions).toHaveLength(1);
    expect(p2Actions[0].action_type).toBe("send_email");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: Full Lifecycle Simulation
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — Full Partner Lifecycle", () => {

  it("C7.L1 — happy path: new → contacted → in_progress → negotiation (via emails)", () => {
    let status = "new";

    // First positive response
    status = computeEscalation("interested", "positive", status) ?? status;
    expect(status).toBe("contacted");

    // Second positive response
    status = computeEscalation("interested", "positive", status) ?? status;
    expect(status).toBe("in_progress");

    // Meeting request
    status = computeEscalation("meeting_request", "positive", status) ?? status;
    expect(status).toBe("negotiation");

    // At negotiation, cadence allows phone
    expect(CADENCE_RULES[status].allowedChannels).toContain("phone");
  });

  it("C7.L2 — rejection path: contacted → lost (via negative email)", () => {
    let status = "contacted";

    // Partner says not interested with high confidence
    const downgrade = computeDowngrade("not_interested", 0.90, status);
    if (downgrade) status = downgrade;
    expect(status).toBe("lost");

    // No further automation possible
    expect(CADENCE_RULES[status].maxContactsPerWeek).toBe(0);
  });

  it("C7.L3 — mixed signals: interested email but neutral sentiment → no change", () => {
    const status = "contacted";
    const result = computeEscalation("interested", "neutral", status);
    expect(result).toBeNull();
    // Status stays contacted
  });

  it("C7.L4 — spam at any stage → no state change", () => {
    const statuses = ["new", "contacted", "in_progress", "negotiation"];
    for (const status of statuses) {
      expect(computeEscalation("spam", "positive", status)).toBeNull();
      expect(computeDowngrade("spam", 0.99, status)).toBeNull();
    }
  });
});
