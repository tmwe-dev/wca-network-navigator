import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { loadSync({ export: true, examplePath: null }); } catch (_) { /* ignore */ }
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/batch-enrichment-worker`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("POST without Authorization returns 401", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
  const json = await res.json();
  assertEquals(json.error, "Unauthorized");
});

// Smoke test del worker con anon key: deve rispondere 200 con summary JSON.
// Non verifichiamo enriched > 0 (dipende da partner pending nel DB).
Deno.test("POST with anon returns 200 and reports selection log", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  // 200 = run normale, 200+paused = AI pausa attiva, entrambi accettabili.
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const json = await res.json();
  // Forma di risposta nota:
  assert(
    json.paused === true ||
      json.message === "No partners to enrich" ||
      typeof json.selected === "number" ||
      typeof json.success === "boolean",
    `unexpected response shape: ${JSON.stringify(json)}`,
  );
  // BATCH_SIZE alzato a 8 (F): se selected è numerico, non deve superare 8.
  if (typeof json.selected === "number") {
    assert(json.selected <= 8, `selected ${json.selected} exceeds BATCH_SIZE=8`);
  }
});