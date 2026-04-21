/**
 * COLLAUDO Catena 3 — Email Classification Parser (REAL IMPORTS)
 *
 * Verifica che:
 * - parseClassificationResponse gestisca JSON valido e con markdown fences
 * - Categorie non valide → "uncategorized"
 * - Confidence fuori range → clampata a [0,1]
 * - Campi stringa troncati per sicurezza
 * - Array limitati in lunghezza
 * - Input null/vuoto → throws
 *
 * IMPORTA CODICE REALE: src/lib/emailClassification.ts
 */
import { describe, it, expect } from "vitest";
import { parseClassificationResponse, type ClassificationResult } from "@/lib/emailClassification";

// ══════════════════════════════════════════════════════════
// TEST 1: Parsing base — JSON pulito
// ══════════════════════════════════════════════════════════

describe("Collaudo C3 — parseClassificationResponse Basic", () => {

  const VALID_JSON = JSON.stringify({
    category: "interested",
    confidence: 0.92,
    ai_summary: "Il partner ha espresso interesse per i servizi FCL",
    keywords: ["FCL", "interesse", "collaborazione"],
    urgency: "high",
    sentiment: "positive",
    detected_patterns: ["price_inquiry", "service_interest"],
    action_suggested: "Inviare proposta commerciale entro 48h",
    reasoning: "Il tono è entusiasta e chiede dettagli sui servizi",
  });

  it("C3.P1 — parses valid JSON correctly", () => {
    const result = parseClassificationResponse(VALID_JSON);
    expect(result.category).toBe("interested");
    expect(result.confidence).toBe(0.92);
    expect(result.sentiment).toBe("positive");
    expect(result.urgency).toBe("high");
  });

  it("C3.P2 — keywords are preserved as array", () => {
    const result = parseClassificationResponse(VALID_JSON);
    expect(result.keywords).toHaveLength(3);
    expect(result.keywords).toContain("FCL");
  });

  it("C3.P3 — detected_patterns are preserved", () => {
    const result = parseClassificationResponse(VALID_JSON);
    expect(result.detected_patterns).toHaveLength(2);
    expect(result.detected_patterns).toContain("price_inquiry");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: Markdown fence stripping
// ══════════════════════════════════════════════════════════

describe("Collaudo C3 — Markdown Fence Handling", () => {

  it("C3.P4 — strips ```json fences", () => {
    const raw = '```json\n{"category":"spam","confidence":0.99}\n```';
    const result = parseClassificationResponse(raw);
    expect(result.category).toBe("spam");
    expect(result.confidence).toBe(0.99);
  });

  it("C3.P5 — strips bare ``` fences", () => {
    const raw = '```\n{"category":"follow_up","confidence":0.7}\n```';
    const result = parseClassificationResponse(raw);
    expect(result.category).toBe("follow_up");
  });

  it("C3.P6 — handles leading/trailing whitespace", () => {
    const raw = '  \n  {"category":"auto_reply","confidence":0.5}  \n  ';
    const result = parseClassificationResponse(raw);
    expect(result.category).toBe("auto_reply");
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: Sanitizzazione e validazione
// ══════════════════════════════════════════════════════════

describe("Collaudo C3 — Input Sanitization", () => {

  it("C3.S1 — invalid category falls back to 'uncategorized'", () => {
    const raw = JSON.stringify({ category: "hacking_attempt", confidence: 0.5 });
    const result = parseClassificationResponse(raw);
    expect(result.category).toBe("uncategorized");
  });

  it("C3.S2 — invalid urgency falls back to 'normal'", () => {
    const raw = JSON.stringify({ category: "interested", urgency: "SUPER_URGENT" });
    const result = parseClassificationResponse(raw);
    expect(result.urgency).toBe("normal");
  });

  it("C3.S3 — invalid sentiment falls back to 'neutral'", () => {
    const raw = JSON.stringify({ category: "interested", sentiment: "furious" });
    const result = parseClassificationResponse(raw);
    expect(result.sentiment).toBe("neutral");
  });

  it("C3.S4 — confidence > 1 clamped to 1", () => {
    const raw = JSON.stringify({ category: "interested", confidence: 5.0 });
    const result = parseClassificationResponse(raw);
    expect(result.confidence).toBe(1);
  });

  it("C3.S5 — negative confidence clamped to 0", () => {
    const raw = JSON.stringify({ category: "interested", confidence: -0.5 });
    const result = parseClassificationResponse(raw);
    expect(result.confidence).toBe(0);
  });

  it("C3.S6 — non-numeric confidence becomes 0", () => {
    const raw = JSON.stringify({ category: "interested", confidence: "high" });
    const result = parseClassificationResponse(raw);
    expect(result.confidence).toBe(0);
  });

  it("C3.S7 — ai_summary truncated at 1000 chars", () => {
    const longSummary = "A".repeat(2000);
    const raw = JSON.stringify({ category: "interested", ai_summary: longSummary });
    const result = parseClassificationResponse(raw);
    expect(result.ai_summary).toHaveLength(1000);
  });

  it("C3.S8 — reasoning truncated at 1000 chars", () => {
    const longReasoning = "R".repeat(1500);
    const raw = JSON.stringify({ category: "interested", reasoning: longReasoning });
    const result = parseClassificationResponse(raw);
    expect(result.reasoning).toHaveLength(1000);
  });

  it("C3.S9 — action_suggested truncated at 500 chars", () => {
    const longAction = "X".repeat(800);
    const raw = JSON.stringify({ category: "interested", action_suggested: longAction });
    const result = parseClassificationResponse(raw);
    expect(result.action_suggested).toHaveLength(500);
  });

  it("C3.S10 — keywords limited to 20 items", () => {
    const manyKeywords = Array.from({ length: 50 }, (_, i) => `kw${i}`);
    const raw = JSON.stringify({ category: "interested", keywords: manyKeywords });
    const result = parseClassificationResponse(raw);
    expect(result.keywords).toHaveLength(20);
  });

  it("C3.S11 — detected_patterns limited to 10 items", () => {
    const manyPatterns = Array.from({ length: 25 }, (_, i) => `p${i}`);
    const raw = JSON.stringify({ category: "interested", detected_patterns: manyPatterns });
    const result = parseClassificationResponse(raw);
    expect(result.detected_patterns).toHaveLength(10);
  });

  it("C3.S12 — non-array keywords becomes empty array", () => {
    const raw = JSON.stringify({ category: "interested", keywords: "just a string" });
    const result = parseClassificationResponse(raw);
    expect(result.keywords).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: Edge cases e errori
// ══════════════════════════════════════════════════════════

describe("Collaudo C3 — Error Handling", () => {

  it("C3.E1 — null input throws", () => {
    expect(() => parseClassificationResponse(null)).toThrow("Empty AI response");
  });

  it("C3.E2 — empty string throws", () => {
    expect(() => parseClassificationResponse("")).toThrow("Empty AI response");
  });

  it("C3.E3 — invalid JSON throws", () => {
    expect(() => parseClassificationResponse("not json at all")).toThrow();
  });

  it("C3.E4 — completely empty object returns safe defaults", () => {
    const raw = JSON.stringify({});
    const result = parseClassificationResponse(raw);
    expect(result.category).toBe("uncategorized");
    expect(result.confidence).toBe(0);
    expect(result.urgency).toBe("normal");
    expect(result.sentiment).toBe("neutral");
    expect(result.keywords).toEqual([]);
    expect(result.detected_patterns).toEqual([]);
  });

  it("C3.E5 — all 9 valid categories are accepted", () => {
    const validCats = [
      "interested", "not_interested", "request_info", "meeting_request",
      "complaint", "follow_up", "auto_reply", "spam", "uncategorized",
    ];
    for (const cat of validCats) {
      const raw = JSON.stringify({ category: cat });
      const result = parseClassificationResponse(raw);
      expect(result.category).toBe(cat);
    }
  });
});

// ══════════════════════════════════════════════════════════
// TEST 5: Integrazione con leadEscalation
// ══════════════════════════════════════════════════════════

describe("Collaudo C3+C7 — Classification → Escalation Chain", () => {

  // This tests the full chain: AI response → parse → escalation decision
  // Simulates what classify-email-response actually does

  it("C3+7.1 — positive interested email escalates contacted partner", async () => {
    const aiResponse = JSON.stringify({
      category: "interested",
      confidence: 0.92,
      sentiment: "positive",
      urgency: "high",
      ai_summary: "Partner interested in FCL services",
      keywords: ["FCL"],
      detected_patterns: [],
      action_suggested: "Send proposal",
      reasoning: "Positive tone",
    });

    const parsed = parseClassificationResponse(aiResponse);
    expect(parsed.category).toBe("interested");
    expect(parsed.sentiment).toBe("positive");

    // Import dynamically to verify the chain works
    const { computeEscalation } = await import("@/lib/leadEscalation");
    const newStatus = computeEscalation(parsed.category, parsed.sentiment, "contacted");
    expect(newStatus).toBe("in_progress");
  });

  it("C3+7.2 — not_interested email with high confidence downgrades", async () => {
    const aiResponse = JSON.stringify({
      category: "not_interested",
      confidence: 0.88,
      sentiment: "negative",
      urgency: "low",
      ai_summary: "Partner explicitly declined",
      keywords: ["decline"],
      detected_patterns: ["rejection"],
      action_suggested: "Mark as lost",
      reasoning: "Clear rejection",
    });

    const parsed = parseClassificationResponse(aiResponse);
    const { computeDowngrade } = await import("@/lib/leadEscalation");
    const newStatus = computeDowngrade(parsed.category, parsed.confidence, "contacted");
    expect(newStatus).toBe("lost");
  });

  it("C3+7.3 — spam email does NOT trigger any state change", async () => {
    const aiResponse = JSON.stringify({
      category: "spam",
      confidence: 0.99,
      sentiment: "neutral",
      urgency: "low",
      ai_summary: "Automated marketing email",
      keywords: [],
      detected_patterns: ["bulk_mail"],
      action_suggested: "Ignore",
      reasoning: "Mass email pattern",
    });

    const parsed = parseClassificationResponse(aiResponse);
    const { computeEscalation, computeDowngrade } = await import("@/lib/leadEscalation");
    const escalation = computeEscalation(parsed.category, parsed.sentiment, "contacted");
    const downgrade = computeDowngrade(parsed.category, parsed.confidence, "contacted");
    expect(escalation).toBeNull();
    expect(downgrade).toBeNull();
  });
});
