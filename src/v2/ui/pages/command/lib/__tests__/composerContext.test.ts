import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setLastComposerContext,
  getLastComposerContext,
  clearLastComposerContext,
  isRegenerateIntent,
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

describe("isRegenerateIntent", () => {
  it("true per richieste esplicite di rifare/cambiare tono", () => {
    expect(isRegenerateIntent("rifai più amichevole")).toBe(true);
    expect(isRegenerateIntent("riscrivi più breve")).toBe(true);
    expect(isRegenerateIntent("cambia tono")).toBe(true);
    expect(isRegenerateIntent("rigenera con un altro tono")).toBe(true);
    expect(isRegenerateIntent("più diretto per favore")).toBe(true);
  });

  it("true per richieste di vedere/mostrare le bozze già prodotte", () => {
    expect(isRegenerateIntent("fammele vedere nel canvas")).toBe(true);
    expect(isRegenerateIntent("non vedo le nuove versioni")).toBe(true);
    expect(isRegenerateIntent("mostrami le bozze")).toBe(true);
    expect(isRegenerateIntent("riprovaci")).toBe(true);
    expect(isRegenerateIntent("prova di nuovo")).toBe(true);
  });

  it("false per nuove ricerche / prompt iniziali", () => {
    expect(isRegenerateIntent("manda una mail ai partner di Malta")).toBe(false);
    expect(isRegenerateIntent("invito a visitare i magazzini")).toBe(false);
    expect(isRegenerateIntent("")).toBe(false);
  });
});