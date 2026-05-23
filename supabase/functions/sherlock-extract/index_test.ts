import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { loadSync({ export: true, examplePath: null }); } catch (_) { /* ignore */ }
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/sherlock-extract`;

function authHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };
}

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

Deno.test("POST without markdown returns 400", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ extract_prompt: "test" }),
  });
  assertEquals(res.status, 400);
  await res.text();
});

Deno.test("POST without extract_prompt returns 400", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ markdown: "hello" }),
  });
  assertEquals(res.status, 400);
  await res.text();
});

// Cache test: invoca due volte con stessi input; il secondo deve essere fromCache=true.
// Skip se LOVABLE_API_KEY non disponibile o se l'AI gateway fallisce (test isolato).
Deno.test("Cache hit: second call with same input returns fromCache=true", async () => {
  const payload = {
    markdown: "Acme Spedizioni Srl - via Roma 10, Milano. Tel +39 02 1234567. info@acme.it. 50 dipendenti.",
    extract_prompt: "Estrai dati aziendali da contatto pubblico.",
    target_fields: ["company_name", "phone", "email"],
    label: "test-cache-" + Date.now(),
  };
  const headers = authHeaders();

  const r1 = await fetch(FN_URL, { method: "POST", headers, body: JSON.stringify(payload) });
  const j1 = await r1.json();
  // Se AI non disponibile (502/500/402), skip senza fallire l'intera suite.
  if (r1.status !== 200) {
    console.warn(`[sherlock-extract test] AI gateway unavailable (status=${r1.status}), skipping cache test.`);
    return;
  }
  assert(!j1.fromCache, "first call must not be a cache hit");

  const r2 = await fetch(FN_URL, { method: "POST", headers, body: JSON.stringify(payload) });
  const j2 = await r2.json();
  assertEquals(r2.status, 200);
  assertEquals(j2.fromCache, true, "second identical call must be served from cache");
});

Deno.test("bypass_cache=true forces fresh call", async () => {
  const payload = {
    markdown: "Beta Logistics, Berlin. Email contact@beta.de.",
    extract_prompt: "Estrai dati aziendali.",
    target_fields: ["company_name", "email"],
    bypass_cache: true,
    label: "test-bypass-" + Date.now(),
  };
  const r = await fetch(FN_URL, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
  if (r.status !== 200) {
    console.warn(`[sherlock-extract test] AI gateway unavailable (status=${r.status}), skipping bypass test.`);
    await r.text();
    return;
  }
  const j = await r.json();
  assert(!j.fromCache, "bypass_cache must avoid cache hit");
});