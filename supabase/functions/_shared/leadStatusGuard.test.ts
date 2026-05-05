/**
 * Unit test — leadStatusGuard.isValidLeadTransition
 *
 * Copre la matrice delle transizioni canoniche del lead_status:
 *  - escalation monotona consentita
 *  - downgrade vietato
 *  - terminali (archived/blacklisted) sempre raggiungibili
 *  - ritorno da terminale vietato
 *  - stessa transizione (no-op) vietata
 *  - status sconosciuto vietato
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isValidLeadTransition } from "./leadStatusGuard.ts";

Deno.test("isValidLeadTransition: escalation monotona", () => {
  assertEquals(isValidLeadTransition("new", "first_touch_sent"), true);
  assertEquals(isValidLeadTransition("first_touch_sent", "holding"), true);
  assertEquals(isValidLeadTransition("holding", "engaged"), true);
  assertEquals(isValidLeadTransition("engaged", "qualified"), true);
  assertEquals(isValidLeadTransition("qualified", "negotiation"), true);
  assertEquals(isValidLeadTransition("negotiation", "converted"), true);
});

Deno.test("isValidLeadTransition: downgrade vietato", () => {
  assertEquals(isValidLeadTransition("converted", "qualified"), false);
  assertEquals(isValidLeadTransition("engaged", "new"), false);
  assertEquals(isValidLeadTransition("holding", "first_touch_sent"), false);
});

Deno.test("isValidLeadTransition: terminali sempre raggiungibili", () => {
  assertEquals(isValidLeadTransition("new", "archived"), true);
  assertEquals(isValidLeadTransition("converted", "archived"), true);
  assertEquals(isValidLeadTransition("engaged", "blacklisted"), true);
});

Deno.test("isValidLeadTransition: nessun ritorno da terminale", () => {
  assertEquals(isValidLeadTransition("archived", "engaged"), false);
  assertEquals(isValidLeadTransition("blacklisted", "new"), false);
});

Deno.test("isValidLeadTransition: no-op e null", () => {
  assertEquals(isValidLeadTransition("engaged", "engaged"), false);
  assertEquals(isValidLeadTransition(null, "first_touch_sent"), true);
  assertEquals(isValidLeadTransition(undefined, "new"), false);
});

Deno.test("isValidLeadTransition: status sconosciuti", () => {
  assertEquals(isValidLeadTransition("new", "ghost_status"), false);
  assertEquals(isValidLeadTransition("foo", "engaged"), false);
});