import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/extension-brain`;

Deno.test("[EB-01] CORS preflight returns 200", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS", headers: { Origin: "http://localhost" } });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[EB-02] Returns response without auth (may succeed or error)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ message: "test", page_context: "wca_directory" }),
  });
  // Extension brain may process without strict auth — just verify it responds
  assertEquals(res.status >= 200, true);
  assertEquals(res.status < 500, true);
  await res.text();
});

Deno.test("[EB-03] GET returns 405 or error", async () => {
  const res = await fetch(FN_URL, {
    method: "GET",
    headers: { apikey: ANON_KEY },
  });
  assertEquals(res.status >= 400, true);
  await res.text();
});
