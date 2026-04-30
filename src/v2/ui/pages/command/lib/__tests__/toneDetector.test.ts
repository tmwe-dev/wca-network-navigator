import { describe, it, expect } from "vitest";
import { detectTone, toneLabel } from "../toneDetector";

describe("toneDetector", () => {
  it("default → professionale", () => {
    expect(detectTone("manda una mail ai partner di Malta")).toBe("professionale");
    expect(detectTone("")).toBe("professionale");
  });

  it("riconosce amichevole", () => {
    expect(detectTone("scrivi qualcosa di molto amichevole")).toBe("amichevole");
    expect(detectTone("ragazzi venite a trovarci, tono caloroso")).toBe("amichevole");
    expect(detectTone("come vecchi amici")).toBe("amichevole");
  });

  it("riconosce informale", () => {
    expect(detectTone("usa un tono informale")).toBe("informale");
    expect(detectTone("rilassato e alla mano")).toBe("informale");
  });

  it("riconosce diretto/breve", () => {
    expect(detectTone("falla diretta e breve")).toBe("diretto");
    expect(detectTone("vai al sodo, no fronzoli")).toBe("diretto");
  });

  it("riconosce professionale esplicito", () => {
    expect(detectTone("mantieni un tono formale e istituzionale")).toBe("professionale");
  });

  it("priorità: amichevole vince su professionale se presenti entrambi", () => {
    expect(detectTone("amichevole ma anche professionale")).toBe("amichevole");
  });

  it("toneLabel produce stringhe IT user-facing", () => {
    expect(toneLabel("amichevole")).toBe("amichevole");
    expect(toneLabel("diretto")).toBe("diretto e breve");
    expect(toneLabel("informale")).toBe("informale");
    expect(toneLabel("professionale")).toBe("professionale");
  });
});