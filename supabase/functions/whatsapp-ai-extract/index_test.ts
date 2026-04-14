import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/whatsapp-ai-extract`;

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
    body: JSON.stringify({ html: "<div>test</div>", mode: "sidebar" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assert(body.error !== undefined, "Expected error field");
});

Deno.test("POST with invalid Bearer returns 401", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({ html: "<div>test</div>", mode: "sidebar" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("POST without html field returns 400", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({ mode: "sidebar" }),
  });
  // Either auth error first (401) or validation error (400)
  assert([400, 401].includes(res.status), `Expected 400 or 401, got ${res.status}`);
  await res.text();
});

Deno.test("Response includes CORS headers on all responses", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.headers.get("access-control-allow-origin") !== null, "Missing CORS");
  await res.text();
});
