/**
 * Contract tests per src/lib/contactSimilarity.ts.
 * Servono come rete di sicurezza dedicata: se qualcuno modifica una delle tre
 * funzioni pure, questi test bloccano prima che la modifica arrivi ai consumer
 * (useContactMerge + contact-merge-logic.test.ts).
 *
 * Batch F20-P0.2 — finding P001-025.
 */
import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
  extractDomain,
  calculateSimilarity,
} from "@/lib/contactSimilarity";

describe("contactSimilarity — divergence guards", () => {
  it("levenshteinDistance: casi classici Wagner-Fischer", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("Saturday", "Sunday")).toBe(3);
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
    expect(levenshteinDistance("abc", "abc")).toBe(0);
  });

  it("levenshteinDistance: case-insensitive + trim (comportamento originario)", () => {
    expect(levenshteinDistance("  John  ", "john")).toBe(0);
    expect(levenshteinDistance("JoHn", "jOhN")).toBe(0);
  });

  it("levenshteinDistance: simmetria", () => {
    expect(levenshteinDistance("alpha", "beta")).toBe(levenshteinDistance("beta", "alpha"));
  });

  it("extractDomain: contratto null/no-at/multi-at (compat legacy)", () => {
    expect(extractDomain(null)).toBe("");
    expect(extractDomain("no-at")).toBe("");
    // Comportamento storico: split('@'), parts[1] — con multi-@ ritorna il segmento tra il primo e il secondo @.
    expect(extractDomain("a@b@c.com")).toBe("b");
    expect(extractDomain("USER@Example.COM")).toBe("example.com");
  });

  it("calculateSimilarity: 0 su null, 1 su identici, monotona sulla distanza", () => {
    expect(calculateSimilarity(null, "x")).toBe(0);
    expect(calculateSimilarity("x", null)).toBe(0);
    expect(calculateSimilarity("John", "John")).toBe(1);
    expect(calculateSimilarity("John", "Johm")).toBeGreaterThan(
      calculateSimilarity("John", "Jane"),
    );
  });
});