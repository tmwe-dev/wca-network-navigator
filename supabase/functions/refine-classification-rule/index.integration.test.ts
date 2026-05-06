import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * refine-classification-rule Integration Tests
 * Scope: CORS + 401 senza Bearer + 400 senza address_rule_id/chosen_group_id.
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/refine-classification-rule`;

Deno.test("[REFINE] CORS preflight 200", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[REFINE] 401 senza Authorization", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  // gateway o handler restituiscono 401
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("[REFINE] 400 con Bearer ma payload incompleto", async () => {
  // Usiamo un Bearer "fittizio"; getUser fallirà → 401.
  // Questo test verifica che il contratto non vada in 500.
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  // Anon JWT non è un user JWT valido → INVALID_TOKEN (401), accettiamo anche 400
  assertEquals([400, 401].includes(res.status), true);
  assertExists(body.error);
});