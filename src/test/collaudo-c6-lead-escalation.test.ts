/**
 * COLLAUDO Catena 7 — Lead Escalation & Downgrade (REAL IMPORTS)
 *
 * Verifica che:
 * - computeEscalation segua la mappa 9-stati: new→first_touch_sent→engaged→qualified
 * - Solo "interested" e "meeting_request" con sentiment positivo scalano
 * - computeDowngrade attivi solo per "not_interested" con confidence ≥0.80
 *   e solo da stati eligible (first_touch_sent, holding)
 * - Nessuna escalation da stati terminali o non-mappati
 * - La catena conversione→archiviazione sia coerente
 *
 * IMPORTA CODICE REALE: src/lib/leadEscalation.ts
 */
import { describe, it, expect } from "vitest";
import { computeEscalation, computeDowngrade } from "@/lib/leadEscalation";

// ══════════════════════════════════════════════════════════
// TEST 1: Escalation — Percorsi felici (9-state taxonomy)
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — computeEscalation Happy Paths", () => {
  it("C7.E1 — interested + positive: new → first_touch_sent", () => {
    expect(computeEscalation("interested", "positive", "new")).toBe("first_touch_sent");
  });

  it("C7.E2 — interested + positive: first_touch_sent → engaged", () => {
    expect(computeEscalation("interested", "positive", "first_touch_sent")).toBe("engaged");
  });

  it("C7.E3 — meeting_request + positive: engaged → qualified", () => {
    expect(computeEscalation("meeting_request", "positive", "engaged")).toBe("qualified");
  });

  it("C7.E4 — interested + very_positive: first_touch_sent → engaged", () => {
    expect(computeEscalation("interested", "very_positive", "first_touch_sent")).toBe("engaged");
  });

  it("C7.E5 — meeting_request + very_positive: new → first_touch_sent", () => {
    expect(computeEscalation("meeting_request", "very_positive", "new")).toBe("first_touch_sent");
  });

  it("C7.E5b — holding + interested + positive → engaged", () => {
    expect(computeEscalation("interested", "positive", "holding")).toBe("engaged");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: Escalation — No-op (deve restituire null)
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — computeEscalation No-Op Cases", () => {
  it("C7.E6 — spam category never escalates", () => {
    expect(computeEscalation("spam", "positive", "first_touch_sent")).toBeNull();
  });

  it("C7.E7 — not_interested never escalates", () => {
    expect(computeEscalation("not_interested", "positive", "first_touch_sent")).toBeNull();
  });

  it("C7.E8 — auto_reply never escalates", () => {
    expect(computeEscalation("auto_reply", "positive", "first_touch_sent")).toBeNull();
  });

  it("C7.E9 — negative sentiment never escalates", () => {
    expect(computeEscalation("interested", "negative", "first_touch_sent")).toBeNull();
  });

  it("C7.E10 — neutral sentiment never escalates", () => {
    expect(computeEscalation("interested", "neutral", "first_touch_sent")).toBeNull();
  });

  it("C7.E11 — mixed sentiment never escalates", () => {
    expect(computeEscalation("interested", "mixed", "first_touch_sent")).toBeNull();
  });

  it("C7.E12 — interested + positive from engaged stays engaged (no change)", () => {
    // interested (not meeting_request) from engaged maps to engaged again → null
    expect(computeEscalation("interested", "positive", "engaged")).toBeNull();
  });

  it("C7.E13 — qualified has no further escalation in map", () => {
    expect(computeEscalation("interested", "positive", "qualified")).toBeNull();
  });

  it("C7.E14 — converted has no escalation path", () => {
    expect(computeEscalation("interested", "positive", "converted")).toBeNull();
  });

  it("C7.E15 — negotiation has no escalation path in map", () => {
    expect(computeEscalation("interested", "positive", "negotiation")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: Downgrade Logic (9-state: only first_touch_sent, holding eligible)
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — computeDowngrade", () => {
  it("C7.D1 — not_interested + high confidence from first_touch_sent → archived", () => {
    expect(computeDowngrade("not_interested", 0.95, "first_touch_sent")).toBe("archived");
  });

  it("C7.D2 — not_interested + high confidence from holding → archived", () => {
    expect(computeDowngrade("not_interested", 0.85, "holding")).toBe("archived");
  });

  it("C7.D3 — not_interested + exact threshold 0.80 from first_touch_sent → archived", () => {
    expect(computeDowngrade("not_interested", 0.8, "first_touch_sent")).toBe("archived");
  });

  it("C7.D4 — not_interested + below threshold → null (no downgrade)", () => {
    expect(computeDowngrade("not_interested", 0.79, "first_touch_sent")).toBeNull();
  });

  it("C7.D5 — not_interested + low confidence → null", () => {
    expect(computeDowngrade("not_interested", 0.5, "first_touch_sent")).toBeNull();
  });

  it("C7.D6 — wrong category with high confidence → null", () => {
    expect(computeDowngrade("interested", 0.95, "first_touch_sent")).toBeNull();
    expect(computeDowngrade("spam", 0.99, "first_touch_sent")).toBeNull();
  });

  it("C7.D7 — not_interested from engaged → null (not eligible)", () => {
    expect(computeDowngrade("not_interested", 0.95, "engaged")).toBeNull();
  });

  it("C7.D8 — not_interested from converted → null (terminal state)", () => {
    expect(computeDowngrade("not_interested", 0.95, "converted")).toBeNull();
  });

  it("C7.D9 — not_interested from negotiation → null (not eligible)", () => {
    expect(computeDowngrade("not_interested", 0.95, "negotiation")).toBeNull();
  });

  it("C7.D10 — not_interested from new → null (not eligible)", () => {
    expect(computeDowngrade("not_interested", 0.95, "new")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: Conversione Pipeline Integrity (9-state)
// ══════════════════════════════════════════════════════════

describe("Collaudo C7 — Conversion Pipeline Integrity", () => {
  it("C7.P1 — full escalation chain: new → first_touch_sent → engaged → qualified", () => {
    let status = "new";
    status = computeEscalation("interested", "positive", status) ?? status;
    expect(status).toBe("first_touch_sent");

    status = computeEscalation("interested", "positive", status) ?? status;
    expect(status).toBe("engaged");

    status = computeEscalation("meeting_request", "positive", status) ?? status;
    expect(status).toBe("qualified");

    // No further escalation possible from qualified
    const next = computeEscalation("meeting_request", "positive", status);
    expect(next).toBeNull();
  });

  it("C7.P2 — escalation never skips steps", () => {
    // Can't go directly from new to engaged
    const result = computeEscalation("interested", "positive", "new");
    expect(result).toBe("first_touch_sent"); // Not "engaged"
  });

  it("C7.P3 — downgrade from eligible status is immediate to archived", () => {
    // A partner at first_touch_sent who says "not interested" goes directly to archived
    const result = computeDowngrade("not_interested", 0.9, "first_touch_sent");
    expect(result).toBe("archived");
  });

  it("C7.P4 — engaged cannot be downgraded automatically", () => {
    // Partners who are engaged can't be auto-downgraded (not in eligible list)
    const result = computeDowngrade("not_interested", 0.99, "engaged");
    expect(result).toBeNull();
  });

  it("C7.P5 — terminal/non-mapped states have no escalation or downgrade", () => {
    // converted
    expect(computeEscalation("interested", "positive", "converted")).toBeNull();
    expect(computeDowngrade("not_interested", 0.99, "converted")).toBeNull();
    // qualified (no further escalation in map)
    expect(computeEscalation("interested", "positive", "qualified")).toBeNull();
    expect(computeDowngrade("not_interested", 0.99, "qualified")).toBeNull();
  });
});
