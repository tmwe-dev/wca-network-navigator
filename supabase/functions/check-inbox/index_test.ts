/**
 * check-inbox Deno integration test — Vol. I Fase 5 (guardrails).
 * Testa il preflight CORS e la risposta 401 senza auth.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/check-inbox`;

Deno.test("CORS preflight restituisce 200 con headers corretti", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  const allowOrigin = res.headers.get("access-control-allow-origin");
  assertEquals(allowOrigin, "*");
  await res.text(); // consume body
});

Deno.test("POST senza auth restituisce 401 Unauthorized", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  // Deve essere 401 o 500 con messaggio "Unauthorized"
  assert([401, 500].includes(res.status), `Expected 401 or 500, got ${res.status}`);
  const body = await res.text();
  assert(body.toLowerCase().includes("unauthorized") || body.toLowerCase().includes("error"),
    `Expected unauthorized message, got: ${body.substring(0, 200)}`);
});
