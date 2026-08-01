import { describe, it, expect } from "vitest";
import { parseClassificationResponse } from "@/lib/emailClassification";

describe("parseClassificationResponse", () => {
  it("parses valid JSON with all fields", () => {
    const raw = JSON.stringify({
      category: "interested",
      confidence: 0.92,
      ai_summary: "Client wants to proceed",
      keywords: ["proceed", "partnership"],
      urgency: "high",
      sentiment: "positive",
      detected_patterns: ["buying_signal"],
      action_suggested: "Schedule call",
      reasoning: "Clear intent",
    });
    const r = parseClassificationResponse(raw);
    expect(r.category).toBe("interested");
    expect(r.confidence).toBe(0.92);
    expect(r.urgency).toBe("high");
    expect(r.sentiment).toBe("positive");
  });

  it("strips markdown fences", () => {
    const raw = '```json\n{"category":"spam","confidence":0.8}\n```';
    const r = parseClassificationResponse(raw);
    expect(r.category).toBe("spam");
  });

  it("defaults invalid category to uncategorized", () => {
    const raw = JSON.stringify({ category: "unknown_cat", confidence: 0.5 });
    expect(parseClassificationResponse(raw).category).toBe("uncategorized");
  });

  it("clamps confidence to [0,1]", () => {
    const r1 = parseClassificationResponse(JSON.stringify({ confidence: 1.5 }));
    expect(r1.confidence).toBe(1);
    const r2 = parseClassificationResponse(JSON.stringify({ confidence: -0.3 }));
    expect(r2.confidence).toBe(0);
  });

  it("defaults invalid urgency to normal", () => {
    const r = parseClassificationResponse(JSON.stringify({ urgency: "extreme" }));
    expect(r.urgency).toBe("normal");
  });

  it("defaults invalid sentiment to neutral", () => {
    const r = parseClassificationResponse(JSON.stringify({ sentiment: "angry" }));
    expect(r.sentiment).toBe("neutral");
  });

  it("truncates ai_summary to 1000 chars", () => {
    const long = "x".repeat(2000);
    const r = parseClassificationResponse(JSON.stringify({ ai_summary: long }));
    expect(r.ai_summary.length).toBe(1000);
  });

  it("handles missing keywords gracefully", () => {
    const r = parseClassificationResponse(JSON.stringify({}));
    expect(r.keywords).toEqual([]);
  });

  it("limits keywords to 20 items", () => {
    const kws = Array.from({ length: 30 }, (_, i) => `kw${i}`);
    const r = parseClassificationResponse(JSON.stringify({ keywords: kws }));
    expect(r.keywords.length).toBe(20);
  });

  it("throws on null input", () => {
    expect(() => parseClassificationResponse(null)).toThrow("Empty AI response");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseClassificationResponse("not json")).toThrow();
  });

  it("parses all 9 valid categories", () => {
    const cats = ["interested", "not_interested", "request_info", "meeting_request",
      "complaint", "follow_up", "auto_reply", "spam", "uncategorized"];
    for (const cat of cats) {
      const r = parseClassificationResponse(JSON.stringify({ category: cat }));
      expect(r.category).toBe(cat);
    }
  });
});
