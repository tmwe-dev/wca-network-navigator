// Deno tests per authGuard — copertura E2.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { requireAuth, isAuthError } from "./authGuard.ts";

const CORS = { "Access-Control-Allow-Origin": "*" };

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("https://x.test/fn", { method: "POST", headers });
}

Deno.test("verbose default: AUTH_REQUIRED body/status/headers byte-identici pre-E2", async () => {
  const res = await requireAuth(makeReq(), CORS);
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await res.text(), JSON.stringify({ error: "AUTH_REQUIRED", message: "Bearer token required" }));
});

Deno.test("terse: AUTH_REQUIRED body == {\"error\":\"AUTH_REQUIRED\"}", async () => {
  const res = await requireAuth(makeReq(), CORS, { errorFormat: "terse" });
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await res.text(), '{"error":"AUTH_REQUIRED"}');
});

Deno.test("terse: AUTH_INVALID body == {\"error\":\"AUTH_INVALID\"} con token non valido", async () => {
  // Env fittizio: SUPABASE_URL/ANON_KEY validi ma token bogus → getClaims fallisce.
  Deno.env.set("SUPABASE_URL", "https://zrbditqddhjkutzjycgi.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4");
  const res = await requireAuth(
    makeReq({ Authorization: "Bearer not-a-real-jwt" }),
    CORS,
    { errorFormat: "terse" },
  );
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(await res.text(), '{"error":"AUTH_INVALID"}');
});

Deno.test("verbose: AUTH_INVALID body pre-E2 con token non valido", async () => {
  Deno.env.set("SUPABASE_URL", "https://zrbditqddhjkutzjycgi.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4");
  const res = await requireAuth(makeReq({ Authorization: "Bearer not-a-real-jwt" }), CORS);
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(await res.text(), JSON.stringify({ error: "AUTH_INVALID", message: "Invalid or expired token" }));
});