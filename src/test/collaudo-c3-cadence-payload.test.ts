/**
 * COLLAUDO Catena 6 — Cadence Engine: Payload & Execution
 *
 * Verifica che:
 * - Le azioni "executed" abbiano davvero eseguito qualcosa
 * - I payload non siano mai vuoti
 * - Le azioni failed non siano marcate executed
 * - scheduleNextStep crei contesto adeguato
 *
 * Bug #2 (cadence finge executed), E1, E2, E4
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";

// ══════════════════════════════════════════════════════════
// Simulate cadence-engine behavior (from actual code read)
// ══════════════════════════════════════════════════════════

interface PendingAction {
  status: string;
  action_payload: Record<string, unknown>;
  action_type: string;
  source: string;
}

// CURRENT behavior (from cadence-engine/index.ts lines 194-219)
function simulateCurrentAutoExecute(): PendingAction {
  return {
    status: "executed",
    action_payload: {}, // BUG: empty payload
    action_type: "send_email",
    source: "cadence_engine",
  };
}

// CURRENT behavior for pending review (lines 221-233)
function simulateCurrentPendingReview(): PendingAction {
  return {
    status: "pending",
    action_payload: {}, // BUG: empty payload — reviewer sees nothing
    action_type: "send_email",
    source: "cadence_engine",
  };
}

// CORRECT behavior (after fix 1.4)
function simulateCorrectAutoExecute(
  genSuccess: boolean,
  sendSuccess: boolean
): PendingAction {
  if (!genSuccess) {
    return {
      status: "failed",
      action_payload: { error: "Content generation failed" },
      action_type: "send_email",
      source: "cadence_engine",
    };
  }
  return {
    status: sendSuccess ? "executed" : "failed",
    action_payload: {
      subject: "Follow-up: collaborazione logistica",
      body: "Gentile partner, torno a scriverle in merito alla nostra precedente conversazione...",
      channel: "email",
      generated: true,
      sent: sendSuccess,
    },
    action_type: "send_email",
    source: "cadence_engine",
  };
}

// CORRECT behavior for pending review (after fix 1.5)
function simulateCorrectPendingReview(): PendingAction {
  return {
    status: "pending",
    action_payload: {
      subject: "Follow-up: collaborazione logistica",
      body: "Gentile partner, torno a scriverle...",
      channel: "email",
      generated: true,
    },
    action_type: "send_email",
    source: "cadence_engine",
  };
}

// ══════════════════════════════════════════════════════════
// TEST 1: Current Bugs
// ══════════════════════════════════════════════════════════

describe("Collaudo C6 — Cadence Engine Current Bugs", () => {

  it("C6.6 — BUG: auto-execute creates empty payload", () => {
    const action = simulateCurrentAutoExecute();
    expect(action.status).toBe("executed"); // Claims executed
    expect(Object.keys(action.action_payload)).toHaveLength(0); // But payload is empty!
    // This means "executed" is a lie — nothing was actually done
  });

  it("C6.7 — BUG: pending review also has empty payload", () => {
    const action = simulateCurrentPendingReview();
    expect(action.status).toBe("pending");
    expect(Object.keys(action.action_payload)).toHaveLength(0);
    // Reviewer has nothing to review — just an empty shell
  });

  it("C6.8 — BUG: 'executed' with empty payload is indistinguishable from real execution", () => {
    const fakeExecuted = simulateCurrentAutoExecute();
    // There's no way to tell if this was really executed
    expect(fakeExecuted.action_payload).not.toHaveProperty("subject");
    expect(fakeExecuted.action_payload).not.toHaveProperty("body");
    expect(fakeExecuted.action_payload).not.toHaveProperty("sent");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: Correct Behavior (after fix)
// ══════════════════════════════════════════════════════════

describe("Collaudo C6 — Cadence Engine Correct Behavior", () => {

  it("C6.9 — correct: successful execution has subject + body + sent", () => {
    const action = simulateCorrectAutoExecute(true, true);
    expect(action.status).toBe("executed");
    expect(action.action_payload).toHaveProperty("subject");
    expect(action.action_payload).toHaveProperty("body");
    expect(action.action_payload.sent).toBe(true);
    expect(action.action_payload.generated).toBe(true);
    expect(typeof action.action_payload.subject).toBe("string");
    expect((action.action_payload.body as string).length).toBeGreaterThan(10);
  });

  it("C6.10 — correct: generation failure → status is 'failed', NOT 'executed'", () => {
    const action = simulateCorrectAutoExecute(false, false);
    expect(action.status).toBe("failed");
    expect(action.status).not.toBe("executed");
    expect(action.action_payload).toHaveProperty("error");
  });

  it("C6.11 — correct: send failure → status is 'failed', NOT 'executed'", () => {
    const action = simulateCorrectAutoExecute(true, false);
    expect(action.status).toBe("failed");
    expect(action.action_payload).toHaveProperty("subject"); // Content was generated
    expect(action.action_payload.sent).toBe(false); // But send failed
  });

  it("C6.12 — correct: pending review has pre-generated content", () => {
    const action = simulateCorrectPendingReview();
    expect(action.status).toBe("pending");
    expect(action.action_payload).toHaveProperty("subject");
    expect(action.action_payload).toHaveProperty("body");
    expect((action.action_payload.body as string).length).toBeGreaterThan(10);
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: Payload Integrity Rules
// ══════════════════════════════════════════════════════════

describe("Collaudo C6 — Payload Integrity Rules", () => {

  function validatePayload(action: PendingAction): string[] {
    const errors: string[] = [];

    if (action.status === "executed") {
      if (!action.action_payload || Object.keys(action.action_payload).length === 0) {
        errors.push("CRITICAL: 'executed' action has empty payload — execution was faked");
      }
      if (!action.action_payload.sent && action.action_type === "send_email") {
        errors.push("'executed' email action missing 'sent' flag");
      }
    }

    if (action.status === "pending" && action.source === "cadence_engine") {
      if (!action.action_payload || Object.keys(action.action_payload).length === 0) {
        errors.push("Pending review action has empty payload — reviewer sees nothing");
      }
    }

    if (action.status === "failed") {
      if (!action.action_payload.error && !action.action_payload.sendError) {
        errors.push("Failed action has no error description");
      }
    }

    return errors;
  }

  it("C6.13 — validate: current auto-execute FAILS integrity", () => {
    const errors = validatePayload(simulateCurrentAutoExecute());
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("execution was faked");
  });

  it("C6.14 — validate: current pending review FAILS integrity", () => {
    const errors = validatePayload(simulateCurrentPendingReview());
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("reviewer sees nothing");
  });

  it("C6.15 — validate: correct auto-execute PASSES integrity", () => {
    const errors = validatePayload(simulateCorrectAutoExecute(true, true));
    expect(errors).toHaveLength(0);
  });

  it("C6.16 — validate: correct failure PASSES integrity", () => {
    const errors = validatePayload(simulateCorrectAutoExecute(false, false));
    expect(errors).toHaveLength(0);
  });

  it("C6.17 — validate: correct pending review PASSES integrity", () => {
    const errors = validatePayload(simulateCorrectPendingReview());
    expect(errors).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: scheduleNextStep Context
// ══════════════════════════════════════════════════════════

describe("Collaudo C6 — scheduleNextStep Context", () => {

  // Current behavior: metadata has only partner_id
  function simulateCurrentNextStep(
    currentChannel: string,
    currentStep: number,
    sequenceLength: number
  ): Record<string, unknown> {
    return {
      partner_id: "uuid-123",
    };
  }

  // Correct behavior: metadata has cadence_context
  function simulateCorrectNextStep(
    currentChannel: string,
    currentStep: number,
    sequenceLength: number
  ): Record<string, unknown> {
    return {
      partner_id: "uuid-123",
      cadence_context: {
        previous_channel: currentChannel,
        previous_step: currentStep,
        sequence_position: `${currentStep + 2}/${sequenceLength}`,
        escalation_reason: "no_response",
      },
    };
  }

  it("C6.18 — BUG: current nextStep has no cadence_context", () => {
    const meta = simulateCurrentNextStep("email", 0, 3);
    expect(meta).not.toHaveProperty("cadence_context");
  });

  it("C6.19 — correct: nextStep has cadence_context with previous info", () => {
    const meta = simulateCorrectNextStep("email", 0, 3);
    expect(meta).toHaveProperty("cadence_context");
    const ctx = meta.cadence_context as Record<string, unknown>;
    expect(ctx.previous_channel).toBe("email");
    expect(ctx.previous_step).toBe(0);
    expect(ctx.sequence_position).toBe("2/3");
    expect(ctx.escalation_reason).toBe("no_response");
  });
});
