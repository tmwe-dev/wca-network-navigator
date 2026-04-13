import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

Deno.test("[SW-01] POST without stripe-signature returns error", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ type: "checkout.session.completed" }),
  });
  assertEquals(res.status >= 400, true);
  await res.text();
});

Deno.test("[SW-02] Invalid signature rejected", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      "stripe-signature": "t=12345,v1=invalid",
    },
    body: JSON.stringify({ type: "checkout.session.completed" }),
  });
  assertEquals(res.status >= 400, true);
  await res.text();
});
