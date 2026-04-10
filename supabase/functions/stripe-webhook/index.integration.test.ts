import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

Deno.test("[SW-01] CORS preflight returns 200", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS", headers: { Origin: "http://localhost" } });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[SW-02] POST without stripe-signature returns 400/401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ type: "checkout.session.completed" }),
  });
  // Should reject without valid Stripe signature
  const status = res.status;
  const body = await res.json();
  assertExists(body.error || body.message);
  assertEquals(status >= 400, true);
});

Deno.test("[SW-03] Invalid signature rejected", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      "stripe-signature": "t=12345,v1=invalid",
    },
    body: JSON.stringify({ type: "checkout.session.completed" }),
  });
  const body = await res.json();
  assertExists(body.error || body.message);
  assertEquals(res.status >= 400, true);
});
