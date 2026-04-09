/**
 * apiError — Unit tests per la classe ApiError (Vol. II §5.3).
 */
import { describe, it, expect } from "vitest";
import { ApiError, isApiError } from "@/lib/api/apiError";

describe("ApiError", () => {
  it("costruisce con tutti i campi", () => {
    const err = new ApiError({
      code: "VALIDATION_FAILED",
      message: "Email mancante",
      httpStatus: 422,
      details: { field: "email" },
    });
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(err.message).toBe("Email mancante");
    expect(err.httpStatus).toBe(422);
    expect(err.details).toEqual({ field: "email" });
    expect(err.name).toBe("ApiError");
    expect(err instanceof Error).toBe(true);
  });

  it("toJSON serializza correttamente", () => {
    const err = new ApiError({ code: "SERVER_ERROR", message: "boom", httpStatus: 500 });
    const json = err.toJSON();
    expect(json).toEqual({
      code: "SERVER_ERROR",
      message: "boom",
      httpStatus: 500,
      details: undefined,
    });
  });

  it("isApiError distingue ApiError da Error standard", () => {
    const apiErr = new ApiError({ code: "NOT_FOUND", message: "nope" });
    const stdErr = new Error("nope");
    expect(isApiError(apiErr)).toBe(true);
    expect(isApiError(stdErr)).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError("string")).toBe(false);
  });

  describe("ApiError.from", () => {
    it("passa attraverso un ApiError esistente", () => {
      const orig = new ApiError({ code: "FORBIDDEN", message: "no" });
      expect(ApiError.from(orig)).toBe(orig);
    });

    it("mappa TypeError a NETWORK_ERROR", () => {
      const err = ApiError.from(new TypeError("fetch failed"), "ctx");
      expect(err.code).toBe("NETWORK_ERROR");
      expect(err.details?.context).toBe("ctx");
    });

    it("mappa Error generico con 'fetch' a NETWORK_ERROR", () => {
      const err = ApiError.from(new Error("Failed to fetch"), "ctx");
      expect(err.code).toBe("NETWORK_ERROR");
    });

    it("mappa Error generico senza fetch a UNKNOWN_ERROR", () => {
      const err = ApiError.from(new Error("qualcosa"), "ctx");
      expect(err.code).toBe("UNKNOWN_ERROR");
      expect(err.message).toBe("qualcosa");
    });

    it("mappa stringa a UNKNOWN_ERROR", () => {
      const err = ApiError.from("errore stringa");
      expect(err.code).toBe("UNKNOWN_ERROR");
      expect(err.message).toBe("errore stringa");
    });

    it("mappa null/undefined a UNKNOWN_ERROR con messaggio fallback", () => {
      const err = ApiError.from(null);
      expect(err.code).toBe("UNKNOWN_ERROR");
      expect(err.message).toBe("Errore sconosciuto");
    });
  });

  describe("ApiError.fromResponse", () => {
    it("mappa 401 a UNAUTHENTICATED", async () => {
      const res = new Response(JSON.stringify({ error: "non autenticato" }), { status: 401 });
      const err = await ApiError.fromResponse(res, "login");
      expect(err.code).toBe("UNAUTHENTICATED");
      expect(err.httpStatus).toBe(401);
      expect(err.message).toBe("non autenticato");
    });

    it("mappa 403 a FORBIDDEN", async () => {
      const res = new Response("{}", { status: 403 });
      const err = await ApiError.fromResponse(res);
      expect(err.code).toBe("FORBIDDEN");
    });

    it("mappa 404 a NOT_FOUND", async () => {
      const res = new Response("{}", { status: 404 });
      const err = await ApiError.fromResponse(res);
      expect(err.code).toBe("NOT_FOUND");
    });

    it("mappa 422 a VALIDATION_FAILED", async () => {
      const res = new Response(JSON.stringify({ message: "campo invalido" }), { status: 422 });
      const err = await ApiError.fromResponse(res);
      expect(err.code).toBe("VALIDATION_FAILED");
      expect(err.message).toBe("campo invalido");
    });

    it("mappa 429 a RATE_LIMITED", async () => {
      const res = new Response("{}", { status: 429 });
      const err = await ApiError.fromResponse(res);
      expect(err.code).toBe("RATE_LIMITED");
    });

    it("mappa 500 a SERVER_ERROR", async () => {
      const res = new Response("{}", { status: 500 });
      const err = await ApiError.fromResponse(res);
      expect(err.code).toBe("SERVER_ERROR");
    });

    it("gestisce body non-JSON senza crash", async () => {
      const res = new Response("not json", { status: 500 });
      const err = await ApiError.fromResponse(res);
      expect(err.code).toBe("SERVER_ERROR");
      expect(err.message).toBe("HTTP 500");
    });
  });
});
