import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { loadSync({ export: true, examplePath: null }); } catch (_) { /* env optional */ }
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/outreach-scheduler`;

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(ENDPOINT, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("POST returns JSON (cron function, no auth required)", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assert(
    typeof body.processed === "number" || body.skipped === true,
    `Expected processed count or skipped, got: ${JSON.stringify(body)}`,
  );
});

// ─── Guard doctrine: nessun .single() su lookup nel modulo ───
Deno.test("outreach-scheduler: lookups use .maybeSingle()", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const violations = [...src.matchAll(/\.single\(\)/g)];
  assertEquals(
    violations.length,
    0,
    `Found ${violations.length} .single() usage(s) — doctrine requires .maybeSingle() for nullable lookups`,
  );
});

// ─── Guard: result persistito non deve contenere _mission internal ───
Deno.test("outreach-scheduler: _mission stripped before persistence", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  // Verifica che esista la destructuring che rimuove _mission prima di update done
  assert(
    /\{\s*_mission\s*:\s*preloadedMission\s*,\s*\.\.\.resultToPersist\s*\}/.test(src),
    "Missing _mission strip before persisting outreach_schedules.result",
  );
});