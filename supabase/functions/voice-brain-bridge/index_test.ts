import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
loadSync({ export: true, allowEmptyValues: true });
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/voice-brain-bridge`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assertEquals(res.status, 200);
  const ao = res.headers.get("access-control-allow-origin");
  assert(ao !== null, "Missing CORS allow-origin header");
  await res.text();
});

Deno.test("POST without auth or bridge token returns 401", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ utterance: "hello" }),
  });
  assert([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
  await res.text();
});

Deno.test("POST with invalid bridge_token returns 401/403", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ utterance: "hello", bridge_token: "fake-token-xyz" }),
  });
  assert([401, 403, 500].includes(res.status), `Expected auth error, got ${res.status}`);
  await res.text();
});

Deno.test("POST with empty body returns error", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.status >= 400, `Expected error status, got ${res.status}`);
  await res.text();
});

Deno.test("Response includes Content-Type application/json", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ utterance: "test" }),
  });
  const ct = res.headers.get("content-type");
  assert(ct?.includes("application/json"), `Expected JSON content-type, got ${ct}`);
  await res.text();
});
