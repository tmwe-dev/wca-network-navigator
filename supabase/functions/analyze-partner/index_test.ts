import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
loadSync({ export: true, allowEmptyValues: true });
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/analyze-partner`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("POST without auth returns error", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ partnerId: "fake-id" }),
  });
  assert(res.status >= 400, `Expected error without auth, got ${res.status}`);
  await res.text();
});

Deno.test("POST with invalid Bearer returns auth error", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer bad-token",
    },
    body: JSON.stringify({ partnerId: "fake-id" }),
  });
  assert(res.status >= 400, `Expected auth error, got ${res.status}`);
  await res.text();
});

Deno.test("POST with empty body returns error", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.status >= 400, `Expected error for missing partnerId, got ${res.status}`);
  await res.text();
});

Deno.test("Response has CORS and JSON content-type", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.headers.get("access-control-allow-origin") !== null, "Missing CORS");
  assert(res.headers.get("content-type")?.includes("application/json"), "Missing JSON ct");
  await res.text();
});
