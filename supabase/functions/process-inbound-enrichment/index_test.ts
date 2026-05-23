import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { loadSync({ export: true, examplePath: null }); } catch (_) { /* ignore */ }
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/process-inbound-enrichment`;

Deno.test("CORS preflight returns 200/204", async () => {
  const res = await fetch(URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assert([200, 204].includes(res.status), `expected 2xx, got ${res.status}`);
  await res.text();
});

Deno.test("POST returns JSON with processed count", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.headers.get("content-type")?.includes("application/json"));
  const json = await res.json();
  // Contratto: { processed: number } oppure { error }
  assert("processed" in json || "error" in json, `unexpected body: ${JSON.stringify(json)}`);
  if ("processed" in json) assertEquals(typeof json.processed, "number");
});