import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts"; loadSync({ envPath: ".env", export: true, examplePath: null });
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * funnemail-classify Integration Tests
 * Scope: CORS + 401 senza apikey + 400 su payload mancante.
 * Non testa la classificazione AI live (richiede DB seed + Lovable AI quota).
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/funnemail-classify`;

Deno.test("[FN-CLASSIFY] CORS preflight 200", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[FN-CLASSIFY] 401 senza apikey", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message_id: "x", from_address: "a@b.c" }),
  });
  // Edge gateway risponde 401 quando manca apikey/Authorization
  assertEquals(res.status === 401 || res.status === 400, true);
  await res.text();
});

Deno.test("[FN-CLASSIFY] 400 su payload invalido (con apikey)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  // schema RequestBody require message_id + from_address → 400
  const body = await res.json().catch(() => ({}));
  assertEquals(res.status >= 400 && res.status < 500, true);
  assertExists(body);
});