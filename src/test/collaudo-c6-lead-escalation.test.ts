/**
 * COLLAUDO Catena 7 — Lead Escalation & Downgrade (REAL IMPORTS)
 *
 * Verifica che:
 * - computeEscalation segua la mappa corretta new→contacted→in_progress→negotiation
 * - Solo "interested" e "meeting_request" con sentiment positivo scalano
 * - computeDowngrade attivi solo per "not_interested" con confidence ≥0.80
 * - Nessuna escalation da stati terminali (converted, lost)
 * - La catena conversione→archiviazione sia coerente
 *
 * IMPORTA CODICE REALE: src/lib/leadEscalation.ts
 */
import { describe, it, expect } from "vitest";
import { computeEscalation, computeDowngrade } from "@/lib/leadEscalation";

// ══════════════════════════════════════════════════════════
// TEST 1: Escalation — Percorsi felici
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — computeEscalation Happy Paths", () => {

  it("C7.E1 — interested + positive: new → contacted", () => {
    expect(computeEscalation("interested", "positive", "new")).toBe("contacted");
  });

  it("C7.E2 — interested + positive: contacted → in_progress", () => {
    expect(computeEscalation("interested", "positive", "contacted")).toBe("in_progress");
  });

  it("C7.E3 — meeting_request + positive: in_progress → negotiation", () => {
    expect(computeEscalation("meeting_request", "positive", "in_progress")).toBe("negotiation");
  });

  it("C7.E4 — interested + very_positive: contacted → in_progress", () => {
    expect(computeEscalation("interested", "very_positive", "contacted")).toBe("in_progress");
  });

  it("C7.E5 — meeting_request + very_positive: new → contacted", () => {
    expect(computeEscalation("meeting_request", "very_positive", "new")).toBe("contacted");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: Escalation — No-op (deve restituire null)
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — computeEscalation No-Op Cases", () => {

  it("C7.E6 — spam category never escalates", () => {
    expect(computeEscalation("spam", "positive", "contacted")).toBeNull();
  });

  it("C7.E7 — not_interested never escalates", () => {
    expect(computeEscalation("not_interested", "positive", "contacted")).toBeNull();
  });

  it("C7.E8 — auto_reply never escalates", () => {
    expect(computeEscalation("auto_reply", "positive", "contacted")).toBeNull();
  });

  it("C7.E9 — negative sentiment never escalates", () => {
    expect(computeEscalation("interested", "negative", "contacted")).toBeNull();
  });

  it("C7.E10 — neutral sentiment never escalates", () => {
    expect(computeEscalation("interested", "neutral", "contacted")).toBeNull();
  });

  it("C7.E11 — mixed sentiment never escalates", () => {
    expect(computeEscalation("interested", "mixed", "contacted")).toBeNull();
  });

  it("C7.E12 — interested + positive from in_progress stays in_progress (no change)", () => {
    // interested (not meeting_request) from in_progress maps to in_progress again → null
    expect(computeEscalation("interested", "positive", "in_progress")).toBeNull();
  });

  it("C7.E13 — negotiation has no further escalation", () => {
    expect(computeEscalation("interested", "positive", "negotiation")).toBeNull();
  });

  it("C7.E14 — converted has no escalation path", () => {
    expect(computeEscalation("interested", "positive", "converted")).toBeNull();
  });

  it("C7.E15 — lost has no escalation path", () => {
    expect(computeEscalation("interested", "positive", "lost")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: Downgrade Logic
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — computeDowngrade", () => {

  it("C7.D1 — not_interested + high confidence from contacted → lost", () => {
    expect(computeDowngrade("not_interested", 0.95, "contacted")).toBe("lost");
  });

  it("C7.D2 — not_interested + high confidence from in_progress → lost", () => {
    expect(computeDowngrade("not_interested", 0.85, "in_progress")).toBe("lost");
  });

  it("C7.D3 — not_interested + exact threshold 0.80 from contacted → lost", () => {
    expect(computeDowngrade("not_interested", 0.80, "contacted")).toBe("lost");
  });

  it("C7.D4 — not_interested + below threshold → null (no downgrade)", () => {
    expect(computeDowngrade("not_interested", 0.79, "contacted")).toBeNull();
  });

  it("C7.D5 — not_interested + low confidence → null", () => {
    expect(computeDowngrade("not_interested", 0.50, "contacted")).toBeNull();
  });

  it("C7.D6 — wrong category with high confidence → null", () => {
    expect(computeDowngrade("interested", 0.95, "contacted")).toBeNull();
    expect(computeDowngrade("spam", 0.99, "contacted")).toBeNull();
  });

  it("C7.D7 — not_interested from negotiation → null (not eligible)", () => {
    // negotiation is NOT in DOWNGRADE_ELIGIBLE_STATUSES
    expect(computeDowngrade("not_interested", 0.95, "negotiation")).toBeNull();
  });

  it("C7.D8 — not_interested from converted → null (terminal state)", () => {
    expect(computeDowngrade("not_interested", 0.95, "converted")).toBeNull();
  });

  it("C7.D9 — not_interested from lost → null (already lost)", () => {
    expect(computeDowngrade("not_interested", 0.95, "lost")).toBeNull();
  });

  it("C7.D10 — not_interested from new → null (not eligible)", () => {
    expect(computeDowngrade("not_interested", 0.95, "new")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: Conversione Pipeline Integrity
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — Conversion Pipeline Integrity", () => {

  it("C7.P1 — full escalation chain: new → contacted → in_progress → negotiation", () => {
    let status = "new";
    status = computeEscalation("interested", "positive", status) ?? status;
    expect(status).toBe("contacted");

    status = computeEscalation("interested", "positive", status) ?? status;
    expect(status).toBe("in_progress");

    status = computeEscalation("meeting_request", "positive", status) ?? status;
    expect(status).toBe("negotiation");

    // No further escalation possible
    const next = computeEscalation("meeting_request", "positive", status);
    expect(next).toBeNull();
  });

  it("C7.P2 — escalation never skips steps", () => {
    // Can't go directly from new to in_progress
    const result = computeEscalation("interested", "positive", "new");
    expect(result).toBe("contacted"); // Not "in_progress"
  });

  it("C7.P3 — downgrade from mid-funnel is immediate", () => {
    // A partner at in_progress who says "not interested" goes directly to lost
    const result = computeDowngrade("not_interested", 0.90, "in_progress");
    expect(result).toBe("lost");
    // No intermediate step — straight to terminal
  });

  it("C7.P4 — BUG AUDIT: negotiation cannot be downgraded automatically", () => {
    // This is a design decision, not a bug per se, but worth documenting:
    // Partners who are in negotiation phase can't be auto-downgraded
    // Only manual intervention can move them to "lost"
    const result = computeDowngrade("not_interested", 0.99, "negotiation");
    expect(result).toBeNull();
    // This means: if a partner in negotiation says "not interested",
    // the system does NOT auto-downgrade — requires human review
  });

  it("C7.P5 — terminal states are truly terminal (no escalation or downgrade)", () => {
    // converted
    expect(computeEscalation("interested", "positive", "converted")).toBeNull();
    expect(computeDowngrade("not_interested", 0.99, "converted")).toBeNull();
    // lost
    expect(computeEscalation("interested", "positive", "lost")).toBeNull();
    expect(computeDowngrade("not_interested", 0.99, "lost")).toBeNull();
  });
});
