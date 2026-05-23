import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { loadSync({ export: true, examplePath: null }); } catch (_) { /* env may be injected differently */ }
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/scrape-website`;

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

Deno.test("POST without url returns 400", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.error, "url required");
});

Deno.test("Default include returns full payload (backward-compat)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url: "https://example.com" }),
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const json = await res.json();
  // All blocks present by default
  assert("title" in json, "title missing");
  assert("emails" in json, "emails missing");
  assert("phones" in json, "phones missing");
  assert("headings" in json, "headings missing");
  assert("links" in json, "links missing");
  assert("rawText" in json, "rawText missing");
});

Deno.test("include=['meta'] returns only meta block (token saving)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url: "https://example.com", include: ["meta"] }),
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const json = await res.json();
  assert("title" in json, "title should be included with 'meta'");
  assert(!("rawText" in json), "rawText should NOT be included");
  assert(!("headings" in json), "headings should NOT be included");
  assert(!("links" in json), "links should NOT be included");
  assert(!("emails" in json), "emails should NOT be included");
});

Deno.test("include with invalid keys falls back to defaults", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url: "https://example.com", include: ["bogus", "nope"] }),
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const json = await res.json();
  // Empty filtered → default = all
  assert("title" in json && "rawText" in json, "should fall back to full payload");
});

Deno.test("rawTextCap clamps rawText length", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      url: "https://example.com",
      include: ["rawText"],
      rawTextCap: 800,
    }),
  });
  assert(res.status === 200);
  const json = await res.json();
  if (typeof json.rawText === "string") {
    assert(json.rawText.length <= 800, `rawText too long: ${json.rawText.length}`);
  }
});