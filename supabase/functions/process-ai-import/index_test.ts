import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
loadSync({ export: true, allowEmptyValues: true });
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/process-ai-import`;

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
    body: JSON.stringify({ import_log_id: "fake-id" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "AUTH_REQUIRED");
});

Deno.test("POST with invalid Bearer returns 401 AUTH_INVALID", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer invalid-token-abc",
    },
    body: JSON.stringify({ import_log_id: "fake-id" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "AUTH_INVALID");
});

Deno.test("Response has CORS headers on error", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const ao = res.headers.get("access-control-allow-origin");
  assert(ao !== null, "Missing CORS header on error response");
  await res.text();
});

Deno.test("Response content-type is application/json", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const ct = res.headers.get("content-type");
  assert(ct?.includes("application/json"), `Expected JSON, got ${ct}`);
  await res.text();
});
