import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { guardGeneratedEmailGrounding } from "./groundingGuard.ts";

Deno.test("guardGeneratedEmailGrounding removes SkyBus when absent from source", () => {
  const result = guardGeneratedEmailGrounding({
    subject: "SkyBus per il vostro follow-up",
    body: "<p>Possiamo valutare SkyBus come prossima leva operativa?</p>",
    sourceText: "Partner generico in Italia. Mittente TMWE. Nessun prodotto specifico nel dossier.",
  });

  assertEquals(result.changed, true);
  assertEquals(result.subject.includes("SkyBus"), false);
  assertEquals(result.body.includes("SkyBus"), false);
  assertEquals(result.warnings.length, 2);
});

Deno.test("guardGeneratedEmailGrounding preserves SkyBus when present in source", () => {
  const result = guardGeneratedEmailGrounding({
    subject: "SkyBus per il vostro follow-up",
    body: "<p>Possiamo valutare SkyBus come prossima leva operativa?</p>",
    sourceText: "Dossier: il cliente usa già SkyBus sulle tratte aeroportuali.",
  });

  assertEquals(result.changed, false);
  assertEquals(result.subject.includes("SkyBus"), true);
  assertEquals(result.body.includes("SkyBus"), true);
  assertEquals(result.warnings.length, 0);
});