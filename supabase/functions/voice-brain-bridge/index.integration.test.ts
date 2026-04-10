import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/voice-brain-bridge`;

Deno.test("[VBB-01] CORS preflight returns 200", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS", headers: { Origin: "http://localhost" } });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("[VBB-02] GET returns 405", async () => {
  const res = await fetch(FN_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
  });
  assertEquals(res.status, 405);
  const body = await res.json();
  assertEquals(body.error, "method_not_allowed");
});

Deno.test("[VBB-03] POST without auth returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ utterance: "test" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertExists(body.error);
});

Deno.test("[VBB-04] POST with invalid bridge_token returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ bridge_token: "invalid-token-xyz", utterance: "ciao" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "invalid_or_expired_bridge_token");
});

Deno.test("[VBB-05] POST with invalid JSON returns 400", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      "x-bridge-secret": "wrong-secret",
    },
    body: "not json",
  });
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_json");
});

Deno.test("[VBB-06] POST with wrong shared secret returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      "x-bridge-secret": "definitely-wrong",
    },
    body: JSON.stringify({ utterance: "test", agent_id: "test" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "unauthorized");
});

Deno.test("[VBB-07] Response includes CORS headers", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ utterance: "test" }),
  });
  const acao = res.headers.get("access-control-allow-origin");
  assertEquals(acao, "*");
  await res.text();
});
