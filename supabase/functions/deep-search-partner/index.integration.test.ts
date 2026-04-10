import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/deep-search-partner`;

Deno.test("[DSP-01] CORS preflight returns 200", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS", headers: { Origin: "http://localhost" } });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[DSP-02] Returns error without auth", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ partner_id: "00000000-0000-0000-0000-000000000000" }),
  });
  assertEquals(res.status >= 400, true);
  const body = await res.json();
  assertExists(body.error || body.message);
});

Deno.test("[DSP-03] Response includes CORS on error", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  await res.text();
});
