import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
loadSync({ export: true, allowEmptyValues: true });
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/cadence-engine`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("POST without auth returns 401", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
  const body = await res.json();
  assert(body.error !== undefined, "Expected error field in response");
});

Deno.test("POST with invalid Bearer returns auth error", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer invalid-tok",
    },
    body: JSON.stringify({}),
  });
  assert([401, 403, 500].includes(res.status), `Expected auth error, got ${res.status}`);
  await res.text();
});

Deno.test("Response body is valid JSON", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  let parsed = false;
  try { JSON.parse(text); parsed = true; } catch { /* */ }
  assert(parsed, `Response is not valid JSON: ${text.substring(0, 100)}`);
});

Deno.test("CORS headers present on error response", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.headers.get("access-control-allow-origin") !== null, "Missing CORS");
  await res.text();
});
