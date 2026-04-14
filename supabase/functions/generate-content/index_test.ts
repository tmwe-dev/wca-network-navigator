import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/generate-content`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("POST without auth returns 401 AUTH_REQUIRED", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ action: "email" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "AUTH_REQUIRED");
});

Deno.test("POST with unknown action returns 400", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify({ action: "nonexistent_action" }),
  });
  // Either 400 (unknown action after forwarding) or error from forwarded function
  assert(res.status >= 400, `Expected error for unknown action, got ${res.status}`);
  const body = await res.json();
  assert(body.error !== undefined, "Expected error in response");
});

Deno.test("POST with valid action but invalid token gets forwarded", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer fake-token-123",
    },
    body: JSON.stringify({ action: "email" }),
  });
  // Should forward to generate-email which will reject the token
  assert(res.status >= 400, `Expected forwarded error, got ${res.status}`);
  await res.text();
});

Deno.test("Response has CORS headers", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.headers.get("access-control-allow-origin") !== null, "Missing CORS");
  await res.text();
});
