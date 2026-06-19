import { describe, expect, it } from "vitest";
import { parseLocalIntent } from "../localIntentParser";

describe("localIntentParser", () => {
  const partnerCountContext =
    'CONTESTO TURNO PRECEDENTE: tabella=partners, mode=count, filtri=[country_code eq "MT"].';

  it("eredita la tabella partner per follow-up ellittici con paese", () => {
    const plan = parseLocalIntent("quanti in USA?", partnerCountContext);

    expect(plan?.table).toBe("partners");
    expect(plan?.filters).toEqual([{ column: "country_code", op: "eq", value: "US" }]);
    expect(plan?.title).toBe("Conteggio partner · usa");
  });

  it("non inventa una tabella senza entità né contesto", () => {
    expect(parseLocalIntent("quanti in USA?")).toBeNull();
  });

  it("non applica un filtro paese locale a tabelle non supportate", () => {
    const contactContext = "CONTESTO TURNO PRECEDENTE: tabella=imported_contacts, mode=count, filtri=[nessuno].";

    expect(parseLocalIntent("quanti in USA?", contactContext)).toBeNull();
  });

  it("eredita partner per follow-up ellittici (e in Francia?, Spagna, e la Germania?)", () => {
    const ctx =
      'CONTESTO TURNO PRECEDENTE: tabella=partners, mode=count, filtri=[country_code eq "IT"].';
    const cases: Array<[string, string]> = [
      ["e in Francia?", "FR"],
      ["Spagna", "ES"],
      ["e la Germania?", "DE"],
      ["quanti in Italia", "IT"],
    ];
    for (const [prompt, code] of cases) {
      const plan = parseLocalIntent(prompt, ctx);
      expect(plan?.table).toBe("partners");
      expect(plan?.filters).toEqual([{ column: "country_code", op: "eq", value: code }]);
    }
  });
});