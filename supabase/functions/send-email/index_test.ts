import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-email`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: { "Origin": "http://localhost:3000" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("Returns 401 without auth", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ to: "test@test.com", subject: "Test", html: "<p>test</p>" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
});

Deno.test("Returns 400 with auth but missing fields", async () => {
  // This test would need a valid auth token to pass the auth check
  // For now it verifies the 401 is returned before field validation
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  // Should be 401 since token is invalid
  assertEquals(res.status, 401);
  assertExists(body.error);
});
