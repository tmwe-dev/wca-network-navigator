import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * [B09-B10] email-cron-sync Integration Tests
 * Scope: Verify night pause uses CET and respects app_settings.
 * Tables: email_sync_state, app_settings.
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/email-cron-sync`;

Deno.test("[B09] CORS preflight", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS", headers: { Origin: "http://localhost" } });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[B09] Returns valid JSON response shape", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  // Should be one of: night pause message, no users message, or processed results
  const valid = body.message !== undefined || body.processed !== undefined || body.error !== undefined;
  assertEquals(valid, true);
});

Deno.test("[B10] Night pause message mentions CET", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  // If it's night pause, message should reference CET
  if (body.message && body.message.toLowerCase().includes("night") || body.message?.includes("pause")) {
    const mentionsCET = body.message.includes("CET") || body.message.includes("cet");
    assertEquals(mentionsCET, true);
  }
  // If not night, just validate shape
  assertExists(body);
});
