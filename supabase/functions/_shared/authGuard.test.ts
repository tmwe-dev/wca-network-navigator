// Deno tests offline per authGuard (E2.1).
// - Nessuna rete, nessuna chiave reale/hardcoded, nessun endpoint reale.
// - Sanitizers default (leak-free).
// - Il verificatore claims viene iniettato via `_claimsVerifier` per isolare la logica pura.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { requireAuth, isAuthError, type ClaimsVerifier } from "./authGuard.ts";

const CORS = { "Access-Control-Allow-Origin": "*" };

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("https://x.test/fn", { method: "POST", headers });
}

const verifierOk =
  (userId: string): ClaimsVerifier =>
  async () => ({ sub: userId, error: null });

const verifierInvalid: ClaimsVerifier = async () => ({
  sub: null,
  error: { name: "AuthApiError", message: "invalid claim: missing sub" },
});

const verifierNever: ClaimsVerifier = async () => {
  throw new Error("verifier must not be called when Authorization header is missing");
};

// ---------- AUTH_REQUIRED (Bearer mancante) ----------

Deno.test("verbose default: AUTH_REQUIRED byte-identico pre-E2 (missing Bearer)", async () => {
  const res = await requireAuth(makeReq(), CORS, { _claimsVerifier: verifierNever });
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await res.text(), JSON.stringify({ error: "AUTH_REQUIRED", message: "Bearer token required" }));
});

Deno.test('terse: AUTH_REQUIRED body == {"error":"AUTH_REQUIRED"} (missing Bearer)', async () => {
  const res = await requireAuth(makeReq(), CORS, {
    errorFormat: "terse",
    _claimsVerifier: verifierNever,
  });
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await res.text(), '{"error":"AUTH_REQUIRED"}');
});

Deno.test("AUTH_REQUIRED: header presente ma senza prefisso 'Bearer '", async () => {
  const res = await requireAuth(makeReq({ Authorization: "Basic abcdef" }), CORS, {
    errorFormat: "terse",
    _claimsVerifier: verifierNever,
  });
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(await res.text(), '{"error":"AUTH_REQUIRED"}');
});

// ---------- AUTH_INVALID (verifier fallisce) ----------

Deno.test("verbose default: AUTH_INVALID byte-identico pre-E2 (token invalido)", async () => {
  const res = await requireAuth(makeReq({ Authorization: "Bearer bogus" }), CORS, {
    _claimsVerifier: verifierInvalid,
  });
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(await res.text(), JSON.stringify({ error: "AUTH_INVALID", message: "Invalid or expired token" }));
});

Deno.test('terse: AUTH_INVALID body == {"error":"AUTH_INVALID"} (token invalido)', async () => {
  const res = await requireAuth(makeReq({ Authorization: "Bearer bogus" }), CORS, {
    errorFormat: "terse",
    _claimsVerifier: verifierInvalid,
  });
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(await res.text(), '{"error":"AUTH_INVALID"}');
});

Deno.test("AUTH_INVALID: verifier restituisce sub=null senza error → comunque 401", async () => {
  const nullVerifier: ClaimsVerifier = async () => ({ sub: null, error: null });
  const res = await requireAuth(makeReq({ Authorization: "Bearer bogus" }), CORS, {
    errorFormat: "terse",
    _claimsVerifier: nullVerifier,
  });
  if (!isAuthError(res)) throw new Error("expected Response");
  assertEquals(res.status, 401);
  assertEquals(await res.text(), '{"error":"AUTH_INVALID"}');
});

// ---------- Success path ----------

Deno.test("success: verbose default ritorna { userId, token } (nessuna Response)", async () => {
  const res = await requireAuth(makeReq({ Authorization: "Bearer good-token" }), CORS, {
    _claimsVerifier: verifierOk("user-abc"),
  });
  if (isAuthError(res)) throw new Error("expected AuthResult, got Response");
  assertEquals(res.userId, "user-abc");
  assertEquals(res.token, "good-token");
});

Deno.test("success: terse ritorna il medesimo AuthResult (nessuna divergenza sul success)", async () => {
  const res = await requireAuth(makeReq({ Authorization: "Bearer good-token" }), CORS, {
    errorFormat: "terse",
    _claimsVerifier: verifierOk("user-xyz"),
  });
  if (isAuthError(res)) throw new Error("expected AuthResult, got Response");
  assertEquals(res.userId, "user-xyz");
  assertEquals(res.token, "good-token");
});
