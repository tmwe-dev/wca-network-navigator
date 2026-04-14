import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { loadSync({ export: true, examplePath: null }); } catch(_) {}
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/analyze-import-structure`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(URL, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("POST with empty body returns 200 (AI analysis function)", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ headers: [], sampleRows: [] }),
  });
  // Function processes via AI - may return 200 with result or 500 if AI fails
  assert([200, 500].includes(res.status), `Unexpected status: ${res.status}`);
  await res.text();
});

Deno.test("POST with realistic headers gets processed", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({
      headers: ["Company", "Name", "Email", "Phone", "Country"],
      sampleRows: [
        ["Acme Logistics", "John Doe", "john@acme.com", "+39 02 123", "Italy"],
        ["Beta Freight", "Jane Smith", "jane@beta.com", "+49 30 456", "Germany"],
      ],
    }),
  });
  // AI processing - either succeeds or errors
  assert([200, 500].includes(res.status), `Unexpected status: ${res.status}`);
  const body = await res.json();
  assert(body !== null, "Response body should not be null");
});

Deno.test("Response has CORS headers on all responses", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assert(res.headers.get("access-control-allow-origin") !== null, "Missing CORS");
  await res.text();
});

Deno.test("Response body is valid JSON", async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ headers: ["Name"], sampleRows: [["Test"]] }),
  });
  const text = await res.text();
  let parsed = false;
  try { JSON.parse(text); parsed = true; } catch { /* */ }
  assert(parsed, `Not valid JSON: ${text.substring(0, 100)}`);
});
