import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isHoldingPatternCategory,
  buildAddressPriorityBlock,
  buildCommercialStateBlock,
} from "./promptParts.ts";

Deno.test("isHoldingPatternCategory: detects keywords (case-insensitive)", () => {
  assert(isHoldingPatternCategory("In Attesa"));
  assert(isHoldingPatternCategory("HOLDING_PATTERN"));
  assert(isHoldingPatternCategory("on_hold"));
  assert(isHoldingPatternCategory("pending"));
  assert(!isHoldingPatternCategory("active"));
  assert(!isHoldingPatternCategory(""));
  assert(!isHoldingPatternCategory(null));
  assert(!isHoldingPatternCategory(undefined));
});

Deno.test("buildAddressPriorityBlock: empty when no input", () => {
  assertEquals(buildAddressPriorityBlock({}), "");
});

Deno.test("buildAddressPriorityBlock: includes custom prompt", () => {
  const out = buildAddressPriorityBlock({ addressCustomPrompt: "trattare con priorità" });
  assert(out.includes("ISTRUZIONE PRIORITARIA"));
  assert(out.includes("trattare con priorità"));
  assert(out.endsWith("\n\n"));
});

Deno.test("buildAddressPriorityBlock: holding pattern note for matching category", () => {
  const out = buildAddressPriorityBlock({ addressCategory: "in_attesa" });
  assert(out.includes("HOLDING PATTERN RILEVATO"));
  assert(out.includes("in_attesa"));
});

Deno.test("buildAddressPriorityBlock: plain category for non-holding", () => {
  const out = buildAddressPriorityBlock({ addressCategory: "billing" });
  assert(out.includes("CATEGORIA CONTATTO: billing"));
  assert(!out.includes("HOLDING PATTERN"));
});

Deno.test("buildCommercialStateBlock: empty when no info", () => {
  assertEquals(buildCommercialStateBlock({}), "");
});

Deno.test("buildCommercialStateBlock: by_state strategy uses STATE_TO_TONE", () => {
  const out = buildCommercialStateBlock({
    commercialState: "qualified",
    touchCount: 5,
    warmthScore: 70,
    toneStrategy: "by_state",
  });
  assert(out.includes("Fase: QUALIFIED"));
  assert(out.includes("QUALIFICATO"));
  assert(out.includes("Calore relazione: 70/100"));
});

Deno.test("buildCommercialStateBlock: by_warmth strategy maps touch+warmth to tone", () => {
  const cold = buildCommercialStateBlock({
    commercialState: "new",
    touchCount: 0,
    warmthScore: 0,
    toneStrategy: "by_warmth",
  });
  assert(cold.includes("PRIMO CONTATTO"));

  const warm = buildCommercialStateBlock({
    commercialState: "engaged",
    touchCount: 5,
    warmthScore: 80,
    toneStrategy: "by_warmth",
  });
  assert(warm.includes("RELAZIONE CALDA"));
});

Deno.test("buildCommercialStateBlock: addressCategory holding overrides state", () => {
  const out = buildCommercialStateBlock({
    commercialState: "engaged",
    touchCount: 3,
    addressCategory: "in_attesa",
    toneStrategy: "by_warmth",
  });
  assert(out.includes("Fase: HOLDING"));
  assert(out.includes("[OVERRIDE]"));
  assert(out.includes("CIRCUITO DI ATTESA"));
});