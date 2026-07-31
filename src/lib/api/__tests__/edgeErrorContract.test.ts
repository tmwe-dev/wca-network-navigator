import { describe, it, expect } from "vitest";
import {
  EDGE_ERROR_CODES,
  parseEdgeErrorBody,
  toEdgeErrorCode,
} from "@/lib/api/edgeErrorContract";

describe("edgeErrorContract", () => {
  it("riconosce tutti i codici canonici", () => {
    for (const code of EDGE_ERROR_CODES) {
      expect(toEdgeErrorCode(code)).toBe(code);
    }
    expect(toEdgeErrorCode("NOPE")).toBeNull();
  });

  it("parsa il contratto canonico { error, code, details }", () => {
    expect(
      parseEdgeErrorBody({ error: "no_password", code: "INTERNAL_ERROR", details: "imap" }),
    ).toEqual({
      code: "INTERNAL_ERROR",
      rawCode: "INTERNAL_ERROR",
      message: "no_password",
      details: "imap",
    });
  });

  it("resta retro-compatibile con body legacy senza code", () => {
    expect(parseEdgeErrorBody({ error: "boom" })).toEqual({
      code: null,
      rawCode: null,
      message: "boom",
      details: null,
    });
    expect(parseEdgeErrorBody({ success: false, message: "ko" })?.message).toBe("ko");
  });

  it("espone rawCode anche per codici non canonici", () => {
    const parsed = parseEdgeErrorBody({ error: "x", code: "LEGACY_CODE" });
    expect(parsed?.rawCode).toBe("LEGACY_CODE");
    expect(parsed?.code).toBeNull();
  });

  it("ritorna null su payload privi di informazioni d'errore", () => {
    expect(parseEdgeErrorBody(null)).toBeNull();
    expect(parseEdgeErrorBody("boom")).toBeNull();
    expect(parseEdgeErrorBody({ voices: [] })).toBeNull();
  });
});