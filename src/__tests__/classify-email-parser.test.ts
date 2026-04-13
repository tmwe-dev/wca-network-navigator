import { describe, it, expect } from "vitest";
import { parseClassificationResponse } from "@/lib/emailClassification";

describe("parseClassificationResponse", () => {
  const validJson = {
    category: "interested",
    confidence: 0.92,
    ai_summary: "Il cliente è interessato alla partnership.",
    keywords: ["partnership", "logistics", "freight"],
    urgency: "high",
    sentiment: "positive",
    detected_patterns: ["follow_up_needed"],
    action_suggested: "Rispondere entro 24h con proposta",
    reasoning: "Email mostra chiaro interesse commerciale",
  };

  it("parses valid JSON with all fields", () => {
    const result = parseClassificationResponse(JSON.stringify(validJson));
    expect(result.category).toBe("interested");
    expect(result.confidence).toBe(0.92);
    expect(result.ai_summary).toBe("Il cliente è interessato alla partnership.");
    expect(result.keywords).toEqual(["partnership", "logistics", "freight"]);
    expect(result.urgency).toBe("high");
    expect(result.sentiment).toBe("positive");
    expect(result.detected_patterns).toEqual(["follow_up_needed"]);
    expect(result.action_suggested).toBe("Rispondere entro 24h con proposta");
    expect(result.reasoning).toBe("Email mostra chiaro interesse commerciale");
  });

  it("falls back to 'uncategorized' for invalid category", () => {
    const result = parseClassificationResponse(JSON.stringify({ ...validJson, category: "bogus_category" }));
    expect(result.category).toBe("uncategorized");
  });

  it("clamps confidence > 1 to 1.0", () => {
    const result = parseClassificationResponse(JSON.stringify({ ...validJson, confidence: 5.5 }));
    expect(result.confidence).toBe(1.0);
  });

  it("clamps negative confidence to 0.0", () => {
    const result = parseClassificationResponse(JSON.stringify({ ...validJson, confidence: -0.3 }));
    expect(result.confidence).toBe(0.0);
  });

  it("falls back to 'normal' for invalid urgency", () => {
    const result = parseClassificationResponse(JSON.stringify({ ...validJson, urgency: "super_urgent" }));
    expect(result.urgency).toBe("normal");
  });

  it("parses JSON wrapped in markdown fences", () => {
    const raw = "```json\n" + JSON.stringify(validJson) + "\n```";
    const result = parseClassificationResponse(raw);
    expect(result.category).toBe("interested");
    expect(result.confidence).toBe(0.92);
  });

  it("throws on empty string", () => {
    expect(() => parseClassificationResponse("")).toThrow("Empty AI response");
  });

  it("throws on null", () => {
    expect(() => parseClassificationResponse(null)).toThrow("Empty AI response");
  });

  it("throws on malformed JSON", () => {
    expect(() => parseClassificationResponse("{not valid json")).toThrow();
  });

  it("truncates keywords array to 20 elements", () => {
    const manyKeywords = Array.from({ length: 30 }, (_, i) => `kw${i}`);
    const result = parseClassificationResponse(JSON.stringify({ ...validJson, keywords: manyKeywords }));
    expect(result.keywords).toHaveLength(20);
    expect(result.keywords[0]).toBe("kw0");
    expect(result.keywords[19]).toBe("kw19");
  });

  it("truncates ai_summary to 1000 characters", () => {
    const longSummary = "x".repeat(2000);
    const result = parseClassificationResponse(JSON.stringify({ ...validJson, ai_summary: longSummary }));
    expect(result.ai_summary).toHaveLength(1000);
  });
});
