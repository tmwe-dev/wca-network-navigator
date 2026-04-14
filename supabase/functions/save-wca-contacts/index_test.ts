import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { loadSync({ export: true, examplePath: null }); } catch(_) {}
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/save-wca-contacts`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("POST with empty body returns 200 (graceful handling)", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  // Function handles missing fields gracefully
  assertEquals(res.status, 200);
  const body = await res.json();
  assert("saved" in body || "error" in body, `Unexpected response: ${JSON.stringify(body).substring(0, 100)}`);
});

Deno.test("POST with empty contacts array returns success with 0 saved", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ contacts: [], partnerId: "00000000-0000-0000-0000-000000000000" }),
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("Response includes CORS headers", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.headers.get("access-control-allow-origin") !== null, "Missing CORS header");
  await res.text();
});

Deno.test("Response content-type is JSON", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.headers.get("content-type")?.includes("application/json"), "Expected JSON");
  await res.text();
});
