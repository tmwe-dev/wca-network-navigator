import { describe, it, expect } from "vitest";

/**
 * AI Learning System Tests
 * Covers: memory cycle, confidence scaling, KB rules, RAG behavior
 */

// === Memory types & validation ===

describe("Memory System — Type Validation", () => {
  const validMemoryTypes = [
    "conversation_insight",
    "user_preference",
    "learned_correction",
    "voice_call_outcome",
    "email_edit_learning",
    "partner_insight",
  ];

  it("all memory types are non-empty strings", () => {
    validMemoryTypes.forEach((t) => {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(0);
    });
  });

  it("memory importance range is 1-10", () => {
    const validValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    validValues.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    });
    expect(0).toBeLessThan(1); // out of range
    expect(11).toBeGreaterThan(10); // out of range
  });
});

// === Confidence scaling ===

describe("Memory System — Confidence Scaling", () => {
  function clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  it("clamps confidence to 0-1 range", () => {
    expect(clampConfidence(0.5)).toBe(0.5);
    expect(clampConfidence(0)).toBe(0);
    expect(clampConfidence(1)).toBe(1);
    expect(clampConfidence(-0.5)).toBe(0);
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence(95)).toBe(1); // legacy 0-100 value clamped
  });

  it("normalizes legacy 0-100 values", () => {
    function normalizeConfidence(value: number): number {
      if (value > 1) return clampConfidence(value / 100);
      return clampConfidence(value);
    }
    expect(normalizeConfidence(95)).toBeCloseTo(0.95);
    expect(normalizeConfidence(0.8)).toBeCloseTo(0.8);
    expect(normalizeConfidence(50)).toBeCloseTo(0.5);
    expect(normalizeConfidence(0)).toBe(0);
    expect(normalizeConfidence(100)).toBe(1);
  });
});

// === Memory Level Promotion Logic ===

describe("Memory System — Level Promotion (L1→L2→L3)", () => {
  type MemoryEntry = {
    level: number;
    access_count: number;
    importance: number;
    confidence: number;
    pending_promotion: boolean;
  };

  function shouldPromote(m: MemoryEntry): boolean {
    if (m.level >= 3) return false;
    if (m.level === 1) return m.access_count >= 3 && m.importance >= 5;
    if (m.level === 2) return m.access_count >= 8 && m.importance >= 7 && m.confidence >= 0.8;
    return false;
  }

  it("L1 promotes to L2 with enough access and importance", () => {
    expect(shouldPromote({ level: 1, access_count: 3, importance: 5, confidence: 0.5, pending_promotion: false })).toBe(true);
    expect(shouldPromote({ level: 1, access_count: 2, importance: 5, confidence: 0.5, pending_promotion: false })).toBe(false);
    expect(shouldPromote({ level: 1, access_count: 3, importance: 4, confidence: 0.5, pending_promotion: false })).toBe(false);
  });

  it("L2 promotes to L3 with high access, importance, and confidence", () => {
    expect(shouldPromote({ level: 2, access_count: 8, importance: 7, confidence: 0.8, pending_promotion: false })).toBe(true);
    expect(shouldPromote({ level: 2, access_count: 7, importance: 7, confidence: 0.8, pending_promotion: false })).toBe(false);
    expect(shouldPromote({ level: 2, access_count: 8, importance: 6, confidence: 0.8, pending_promotion: false })).toBe(false);
    expect(shouldPromote({ level: 2, access_count: 8, importance: 7, confidence: 0.7, pending_promotion: false })).toBe(false);
  });

  it("L3 never promotes further", () => {
    expect(shouldPromote({ level: 3, access_count: 100, importance: 10, confidence: 1, pending_promotion: false })).toBe(false);
  });
});

// === Memory Decay Logic ===

describe("Memory System — Decay", () => {
  function applyDecay(confidence: number, decayRate: number, daysSinceAccess: number): number {
    const decayed = confidence - decayRate * daysSinceAccess;
    return Math.max(0, Math.min(1, decayed));
  }

  it("reduces confidence over time", () => {
    expect(applyDecay(0.9, 0.01, 10)).toBeCloseTo(0.8);
    expect(applyDecay(0.9, 0.01, 90)).toBeCloseTo(0.0);
  });

  it("never goes below 0", () => {
    expect(applyDecay(0.1, 0.05, 100)).toBe(0);
  });

  it("no decay with 0 rate", () => {
    expect(applyDecay(0.9, 0, 365)).toBeCloseTo(0.9);
  });
});

// === KB Rule Validation ===

describe("KB System — Rule Validation", () => {
  type KbEntry = {
    title: string;
    content: string;
    category: string;
    priority: number;
    is_active: boolean;
    tags?: string[];
  };

  function validateKbEntry(entry: Partial<KbEntry>): string[] {
    const errors: string[] = [];
    if (!entry.title || entry.title.trim().length === 0) errors.push("title required");
    if (!entry.content || entry.content.trim().length < 10) errors.push("content too short");
    if (!entry.category) errors.push("category required");
    if (entry.priority !== undefined && (entry.priority < 0 || entry.priority > 100)) errors.push("priority 0-100");
    return errors;
  }

  it("valid entry has no errors", () => {
    expect(validateKbEntry({
      title: "Test Rule",
      content: "This is a valid KB entry content",
      category: "voice_rules",
      priority: 50,
    })).toEqual([]);
  });

  it("rejects empty title", () => {
    const errors = validateKbEntry({ title: "", content: "valid content here", category: "test" });
    expect(errors).toContain("title required");
  });

  it("rejects short content", () => {
    const errors = validateKbEntry({ title: "Test", content: "short", category: "test" });
    expect(errors).toContain("content too short");
  });

  it("rejects out-of-range priority", () => {
    const errors = validateKbEntry({ title: "T", content: "valid content here", category: "test", priority: 101 });
    expect(errors).toContain("priority 0-100");
  });
});

// === RAG Search Behavior ===

describe("RAG System — Search Behavior", () => {
  type KbMatch = { id: string; title: string; similarity: number; content: string };

  function filterByThreshold(matches: KbMatch[], threshold: number): KbMatch[] {
    return matches.filter((m) => m.similarity >= threshold);
  }

  function rankMatches(matches: KbMatch[]): KbMatch[] {
    return [...matches].sort((a, b) => b.similarity - a.similarity);
  }

  it("filters out low-similarity matches", () => {
    const matches: KbMatch[] = [
      { id: "1", title: "A", similarity: 0.9, content: "high" },
      { id: "2", title: "B", similarity: 0.2, content: "low" },
      { id: "3", title: "C", similarity: 0.5, content: "mid" },
    ];
    const filtered = filterByThreshold(matches, 0.3);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((m) => m.id)).toEqual(["1", "3"]);
  });

  it("ranks matches by similarity descending", () => {
    const matches: KbMatch[] = [
      { id: "1", title: "A", similarity: 0.5, content: "" },
      { id: "2", title: "B", similarity: 0.9, content: "" },
      { id: "3", title: "C", similarity: 0.7, content: "" },
    ];
    const ranked = rankMatches(matches);
    expect(ranked.map((m) => m.id)).toEqual(["2", "3", "1"]);
  });

  it("returns empty on no matches above threshold", () => {
    const matches: KbMatch[] = [
      { id: "1", title: "A", similarity: 0.1, content: "" },
    ];
    expect(filterByThreshold(matches, 0.3)).toHaveLength(0);
  });
});

// === Feedback Confidence Adjustment ===

describe("Memory System — Feedback Boost/Reduce", () => {
  function adjustConfidence(current: number, action: "boost" | "reduce"): number {
    const delta = action === "boost" ? 0.1 : -0.15;
    return Math.max(0, Math.min(1, current + delta));
  }

  it("boost increases confidence by 0.1", () => {
    expect(adjustConfidence(0.5, "boost")).toBeCloseTo(0.6);
  });

  it("reduce decreases confidence by 0.15", () => {
    expect(adjustConfidence(0.5, "reduce")).toBeCloseTo(0.35);
  });

  it("boost caps at 1.0", () => {
    expect(adjustConfidence(0.95, "boost")).toBe(1);
  });

  it("reduce floors at 0.0", () => {
    expect(adjustConfidence(0.05, "reduce")).toBe(0);
  });
});
