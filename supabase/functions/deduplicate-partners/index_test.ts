import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { loadSync({ export: true, examplePath: null }); } catch (_) { /* ignore */ }
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/deduplicate-partners`;

Deno.test("CORS preflight returns 2xx", async () => {
  const res = await fetch(URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assert([200, 204].includes(res.status), `got ${res.status}`);
  await res.text();
});

Deno.test("POST without auth returns 401", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.status === 401, `expected 401, got ${res.status}`);
  await res.text();
});

Deno.test("POST with invalid Bearer returns 401 (getClaims fails locally)", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({}),
  });
  assert(res.status === 401, `expected 401, got ${res.status}`);
  await res.text();
});