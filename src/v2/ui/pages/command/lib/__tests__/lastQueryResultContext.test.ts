import { describe, it, expect, beforeEach } from "vitest";
import {
  setLastQueryResultContext,
  getLastQueryResultContext,
  clearLastQueryResultContext,
  extractPartnerIdsFromResult,
  isProceedIntent,
} from "../lastQueryResultContext";

describe("lastQueryResultContext", () => {
  beforeEach(() => clearLastQueryResultContext());

  it("memorizza e restituisce partnerIds", () => {
    setLastQueryResultContext({
      partnerIds: ["a", "b"],
      countryCode: "MT",
      countryLabel: "malta",
      originalPrompt: "trovami partner Malta",
    });
    const ctx = getLastQueryResultContext();
    expect(ctx?.partnerIds).toEqual(["a", "b"]);
    expect(ctx?.countryCode).toBe("MT");
  });

  it("mantiene il paese anche se la query conta senza righe/id", () => {
    setLastQueryResultContext({
      partnerIds: [],
      countryCode: "MT",
      countryLabel: "malta",
      originalPrompt: "x",
    });
    expect(getLastQueryResultContext()?.countryCode).toBe("MT");
  });
});

describe("extractPartnerIdsFromResult", () => {
  it("estrae da kind:table su partners", () => {
    const ids = extractPartnerIdsFromResult({
      kind: "table",
      meta: { sourceLabel: "DB · partners + partner_contacts · LIVE" },
      rows: [{ id: "p1" }, { id: "p2" }, { id: "" }, { name: "no-id" }],
    });
    expect(ids).toEqual(["p1", "p2"]);
  });

  it("ignora kind:table non partner", () => {
    const ids = extractPartnerIdsFromResult({
      kind: "table",
      meta: { sourceLabel: "DB · activities" },
      rows: [{ id: "x" }],
    });
    expect(ids).toEqual([]);
  });

  it("estrae da kind:multi part 'partners'", () => {
    const ids = extractPartnerIdsFromResult({
      kind: "multi",
      parts: [
        { table: "partners", rows: [{ id: "p1" }, { id: "p2" }] },
        { table: "contacts", rows: [{ id: "c1" }] },
      ],
    });
    expect(ids).toEqual(["p1", "p2"]);
  });
});

describe("isProceedIntent", () => {
  it.each([
    "vai avanti",
    "vai avanti con la bozza della Lettera di invito",
    "procedi",
    "ok procedi",
    "prepara la bozza",
    "prepara una mail di invito a tutti questi partner",
    "scrivi la lettera",
    "fai la mail",
    "continua",
    "prosegui",
  ])("riconosce: %s", (p) => {
    expect(isProceedIntent(p)).toBe(true);
  });

  it.each(["", "ciao", "trovami partner Malta", "rifai più amichevole"])(
    "non matcha: %s",
    (p) => {
      expect(isProceedIntent(p)).toBe(false);
    },
  );
});