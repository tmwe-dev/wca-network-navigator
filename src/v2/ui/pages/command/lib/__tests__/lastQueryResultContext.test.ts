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

  it("mantiene filtri+selectionLabel anche senza partnerIds e senza country", () => {
    setLastQueryResultContext({
      partnerIds: [],
      countryCode: null,
      countryLabel: null,
      originalPrompt: "Dimmi quelli presenti ad Amman",
      table: "partners",
      filters: [{ column: "city", op: "ilike", value: "Amman" }],
      count: 31,
      selectionLabel: "partner a Amman",
    });
    const ctx = getLastQueryResultContext();
    expect(ctx?.filters?.[0]).toMatchObject({ column: "city", value: "Amman" });
    expect(ctx?.selectionLabel).toBe("partner a Amman");
    expect(ctx?.count).toBe(31);
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
    "Ok adesso Prepara un invito a venire a fare una partita di calcio a giugno",
    "invitali tutti a Milano",
    "manda un invito a tutti",
    "prepara invito a tutti questi partner",
    "voglio che prepari 20 lettere dedicate a ognuno in cui li inviti a collaborare",
    "Genera un'email di collaborazione per i partner di Malta",
    "email di collaborazione per i partner di Malta",
    "genera email di presentazione per tutti i partner di Malta",
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