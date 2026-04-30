import { describe, it, expect } from "vitest";
import { isSynthesisIntent } from "../intentDetector";

describe("isSynthesisIntent", () => {
  it("matches synthesis verbs", () => {
    expect(isSynthesisIntent("Cosa dice la knowledge base in sintesi")).toBe(true);
    expect(isSynthesisIntent("riassumi i risultati")).toBe(true);
    expect(isSynthesisIntent("fammi un riassunto")).toBe(true);
    expect(isSynthesisIntent("spiegami quanto trovato")).toBe(true);
    expect(isSynthesisIntent("in breve cosa contiene")).toBe(true);
    expect(isSynthesisIntent("tldr")).toBe(true);
    expect(isSynthesisIntent("di cosa parla questa kb")).toBe(true);
  });

  it("does not match plain queries", () => {
    expect(isSynthesisIntent("trova partner in italia")).toBe(false);
    expect(isSynthesisIntent("mostra contatti")).toBe(false);
    expect(isSynthesisIntent("quanti partner abbiamo")).toBe(false);
    expect(isSynthesisIntent("e a Miami?")).toBe(false);
  });

  it("ignores empty input", () => {
    expect(isSynthesisIntent("")).toBe(false);
    expect(isSynthesisIntent("   ")).toBe(false);
  });
});
