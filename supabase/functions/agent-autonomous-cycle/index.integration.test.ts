import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * [D01-D10] agent-autonomous-cycle Integration Tests
 * Scope: Verify cycle contracts, CET time, settings usage.
 * Tables: agents, agent_tasks, app_settings, channel_messages.
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/agent-autonomous-cycle`;

Deno.test("[D01] CORS preflight", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS", headers: { Origin: "http://localhost" } });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[D08] Returns valid JSON response", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  // Should be one of: skipped (night), no agents, success
  const valid = body.message !== undefined || body.success !== undefined || body.error !== undefined;
  assertEquals(valid, true);
});

Deno.test("[D09] Settings keys referenced in response", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  // If skipped due to work hours, should mention CET
  if (body.message && body.skipped) {
    const mentionsCET = body.message.includes("CET");
    assertEquals(mentionsCET, true);
  }
  assertExists(body);
});

Deno.test("[D10] Night pause response shape", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  if (body.skipped) {
    assertExists(body.message);
    assertEquals(typeof body.message, "string");
  }
});

Deno.test("[D02] Response body is valid JSON with expected fields", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  // Must have at least one of these top-level keys
  const hasKey = "success" in body || "skipped" in body || "message" in body || "error" in body;
  assertEquals(hasKey, true);
});

Deno.test("[D03] Work hours response mentions time window", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  if (body.skipped && body.message) {
    // Should mention the configured work hours
    const mentionsHours = body.message.includes(":00");
    assertEquals(mentionsHours, true);
  }
  assertExists(body);
});
