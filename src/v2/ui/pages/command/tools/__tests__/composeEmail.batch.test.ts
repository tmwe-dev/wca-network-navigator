/**
 * Regression test per il bug "1 mail invece di 9" su query country-wide
 * (es. "prepara una email per i partner di Malta").
 *
 * Verifica esclusivamente le pure functions di intent detection,
 * NON la rete o la generazione AI.
 */
import { describe, it, expect } from "vitest";
import { detectCountryCode, isCountryWideIntent } from "../composeEmail";

describe("composeEmail · country-wide batch intent", () => {
  describe("detectCountryCode", () => {
    it("riconosce 'partner di Malta'", () => {
      expect(detectCountryCode("quanti partner abbiamo a Malta")?.code).toBe("MT");
    });
    it("riconosce 'partner in Italia'", () => {
      expect(detectCountryCode("prepara email per i partner in Italia")?.code).toBe("IT");
    });
    it("riconosce 'partner di Germania'", () => {
      expect(detectCountryCode("ai partner di Germania")?.code).toBe("DE");
    });
    it("fallback su nome paese standalone", () => {
      expect(detectCountryCode("partner Malta")?.code).toBe("MT");
    });
    it("ritorna null se nessun paese", () => {
      expect(detectCountryCode("dammi una mano")).toBeNull();
    });
  });

  describe("isCountryWideIntent", () => {
    const positives = [
      "Genera un'email di collaborazione per i partner a Malta",
      "ai partner di Germania",
      "prepara una mail ai nostri partner in Italia",
      "tutti i partner di Spagna",
      "per i partner in Francia",
      "ai responsabili di Portogallo",
    ];
    for (const p of positives) {
      it(`riconosce intent batch: "${p.slice(0, 50)}…"`, () => {
        expect(isCountryWideIntent(p)).toBe(true);
      });
    }

    const negatives = [
      "manda una mail a Mario Rossi",
      "ciao",
      "che ore sono",
    ];
    for (const p of negatives) {
      it(`NON è batch: "${p}"`, () => {
        expect(isCountryWideIntent(p)).toBe(false);
      });
    }
  });

  describe("integrazione: bug Malta", () => {
    it("la combinazione 'preparami una email per i partner di Malta' attiva la branch country-wide", () => {
      const prompt = "preparami una email per i partner di Malta";
      const country = detectCountryCode(prompt);
      expect(country?.code).toBe("MT");
      expect(isCountryWideIntent(prompt)).toBe(true);
    });
  });
});