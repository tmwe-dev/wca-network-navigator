import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts"; loadSync({ envPath: ".env", export: true, examplePath: null });
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * classify-emails-batch Integration Tests
 * Scope: CORS + 200 con success+candidates fields.
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/classify-emails-batch`;

Deno.test("[BATCH] CORS preflight 200", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[BATCH] POST risponde 200 con shape attesa", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.candidates !== undefined ? true : undefined);
});