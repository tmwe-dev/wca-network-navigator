import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setLastComposerContext,
  getLastComposerContext,
  clearLastComposerContext,
  getActiveComposerContextSummary,
} from "../composerContext";

describe("composerContext", () => {
  beforeEach(() => {
    clearLastComposerContext();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    clearLastComposerContext();
  });

  it("set/get round-trip preserva i campi", () => {
    setLastComposerContext({
      countryCode: "MT",
      countryLabel: "Malta",
      partnerIds: ["p1", "p2"],
      tone: "amichevole",
      originalGoal: "invito magazzini",
    });
    const ctx = getLastComposerContext();
    expect(ctx?.countryCode).toBe("MT");
    expect(ctx?.partnerIds).toEqual(["p1", "p2"]);
    expect(ctx?.tone).toBe("amichevole");
  });

  it("scade dopo TTL (5 min)", () => {
    setLastComposerContext({
      countryCode: "MT",
      countryLabel: "Malta",
      partnerIds: ["p1"],
      tone: "professionale",
      originalGoal: "x",
    });
    expect(getLastComposerContext()).not.toBeNull();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(getLastComposerContext()).toBeNull();
  });

  it("clear azzera lo stato", () => {
    setLastComposerContext({
      countryCode: "MT",
      countryLabel: "Malta",
      partnerIds: [],
      tone: "professionale",
      originalGoal: "x",
    });
    clearLastComposerContext();
    expect(getLastComposerContext()).toBeNull();
  });
});

describe("getActiveComposerContextSummary", () => {
  beforeEach(() => {
    clearLastComposerContext();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    clearLastComposerContext();
  });

  it("ritorna null se non c'è batch attivo", () => {
    expect(getActiveComposerContextSummary()).toBeNull();
  });

  it("ritorna summary descrittivo con paese, count, tono e TTL", () => {
    setLastComposerContext({
      countryCode: "MT",
      countryLabel: "Malta",
      partnerIds: ["p1", "p2", "p3"],
      tone: "amichevole",
      originalGoal: "invito magazzini",
    });
    const summary = getActiveComposerContextSummary();
    expect(summary).not.toBeNull();
    expect(summary?.type).toBe("composer-batch");
    expect(summary?.toolId).toBe("compose-email");
    expect(summary?.description).toContain("3 bozze");
    expect(summary?.description).toContain("MALTA");
    expect(summary?.description).toContain("amichevole");
    expect(summary?.ttlSecondsLeft).toBeGreaterThan(0);
  });

  it("ritorna null dopo TTL scaduto", () => {
    setLastComposerContext({
      countryCode: "MT",
      countryLabel: "Malta",
      partnerIds: ["p1"],
      tone: "professionale",
      originalGoal: "x",
    });
    expect(getActiveComposerContextSummary()).not.toBeNull();
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(getActiveComposerContextSummary()).toBeNull();
  });
});