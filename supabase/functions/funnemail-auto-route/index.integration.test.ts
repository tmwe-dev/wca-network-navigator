import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * funnemail-auto-route Integration Tests
 * Scope: CORS + 400 missing user_id/from_address.
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/funnemail-auto-route`;

Deno.test("[FN-ROUTE] CORS preflight 200", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[FN-ROUTE] 400 senza user_id/from_address", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ message_id: "x" }),
  });
  const body = await res.json().catch(() => ({}));
  assertEquals(res.status, 400);
  assertExists(body.error);
});