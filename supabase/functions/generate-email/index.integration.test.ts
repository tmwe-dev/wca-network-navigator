import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * [C01-C02] generate-email Integration Tests
 * Scope: Verify email generation contracts.
 * Tables: (requires auth for full test).
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/generate-email`;

Deno.test("[C01] CORS preflight", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS", headers: { Origin: "http://localhost" } });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[C01] Returns 401 without auth", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ partner_id: "test" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

Deno.test("[C02] Error shape on missing params (when unauthed)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assertExists(body.error);
});
