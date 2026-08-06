import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EDGE_ERROR_CODES,
  EDGE_ERROR_STATUS,
  edgeError,
  edgeErrorWithStatus,
  extractErrorMessage,
  isEdgeErrorBody,
} from "./handleEdgeError.ts";

Deno.test("edgeError: contratto canonico { error, code } + status mappato", async () => {
  for (const code of EDGE_ERROR_CODES) {
    const res = edgeError(code, `msg ${code}`);
    assertEquals(res.status, EDGE_ERROR_STATUS[code]);
    assertEquals(res.headers.get("Content-Type"), "application/json");
    const body = await res.json();
    assertEquals(body.code, code);
    assertEquals(body.error, `msg ${code}`);
    assertEquals(isEdgeErrorBody(body), true);
  }
});

Deno.test("edgeError: details opzionale ed extra legacy preservati", async () => {
  const res = edgeError("VALIDATION_ERROR", "bad", "field x", undefined, {
    voices: [],
    status: "missing_key",
  });
  const body = await res.json();
  assertEquals(body.details, "field x");
  assertEquals(body.voices, []);
  assertEquals(body.status, "missing_key");
  // i campi canonici non sono sovrascrivibili dagli extra
  assertEquals(body.error, "bad");
  assertEquals(body.code, "VALIDATION_ERROR");
});

Deno.test("edgeError: extra non può sovrascrivere error/code", async () => {
  const res = edgeError("INTERNAL_ERROR", "real", undefined, undefined, {
    error: "hijack",
    code: "HIJACK",
  });
  const body = await res.json();
  assertEquals(body.error, "real");
  assertEquals(body.code, "INTERNAL_ERROR");
});

Deno.test("edgeErrorWithStatus: preserva status legacy", async () => {
  const res = edgeErrorWithStatus("UPSTREAM_ERROR", "upstream ko", 200, undefined, { voices: [] });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.code, "UPSTREAM_ERROR");
  assertEquals(body.voices, []);
});

Deno.test("isEdgeErrorBody: rifiuta payload non conformi", () => {
  assertEquals(isEdgeErrorBody(null), false);
  assertEquals(isEdgeErrorBody("error"), false);
  assertEquals(isEdgeErrorBody({ error: "x" }), false);
  assertEquals(isEdgeErrorBody({ code: "X" }), false);
  assertEquals(isEdgeErrorBody({ error: "x", code: "X" }), true);
});

Deno.test("extractErrorMessage: normalizza unknown", () => {
  assertEquals(extractErrorMessage(new Error("boom")), "boom");
  assertEquals(extractErrorMessage("boom"), "boom");
  assertEquals(extractErrorMessage(42), "Unknown error");
});
