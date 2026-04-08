import { describe, it, expect } from "vitest";
import { ApiError, isApiError } from "@/lib/api/apiError";

describe("ApiError", () => {
  describe("constructor + toJSON", () => {
    it("preserva code, message, httpStatus, details", () => {
      const e = new ApiError({
        code: "VALIDATION_FAILED",
        message: "campo mancante",
        httpStatus: 422,
        details: { field: "email" },
      });
      expect(e.name).toBe("ApiError");
      expect(e.code).toBe("VALIDATION_FAILED");
      expect(e.message).toBe("campo mancante");
      expect(e.httpStatus).toBe(422);
      expect(e.details).toEqual({ field: "email" });
      expect(e.toJSON()).toMatchObject({
        code: "VALIDATION_FAILED",
        message: "campo mancante",
        httpStatus: 422,
      });
    });

    it("è istanza di Error (catturabile da try/catch generico)", () => {
      const e = new ApiError({ code: "UNKNOWN_ERROR", message: "x" });
      expect(e instanceof Error).toBe(true);
      expect(e instanceof ApiError).toBe(true);
    });
  });

  describe("isApiError", () => {
    it("type guard true su ApiError", () => {
      expect(isApiError(new ApiError({ code: "NETWORK_ERROR", message: "x" }))).toBe(true);
    });

    it("false su Error normale, null, stringa", () => {
      expect(isApiError(new Error("x"))).toBe(false);
      expect(isApiError(null)).toBe(false);
      expect(isApiError("err")).toBe(false);
      expect(isApiError({ code: "X" })).toBe(false);
    });
  });

  describe("ApiError.from", () => {
    it("ritorna se stesso se già ApiError", () => {
      const orig = new ApiError({ code: "FORBIDDEN", message: "no" });
      expect(ApiError.from(orig)).toBe(orig);
    });

    it("classifica TypeError come NETWORK_ERROR", () => {
      const e = ApiError.from(new TypeError("Failed to fetch"));
      expect(e.code).toBe("NETWORK_ERROR");
      expect(e.message).toBe("Failed to fetch");
    });

    it("classifica Error con 'fetch' nel messaggio come NETWORK_ERROR", () => {
      const e = ApiError.from(new Error("fetch aborted"));
      expect(e.code).toBe("NETWORK_ERROR");
    });

    it("classifica Error generico come UNKNOWN_ERROR", () => {
      const e = ApiError.from(new Error("boh"));
      expect(e.code).toBe("UNKNOWN_ERROR");
      expect(e.message).toBe("boh");
    });

    it("classifica stringa come UNKNOWN_ERROR", () => {
      const e = ApiError.from("oops");
      expect(e.code).toBe("UNKNOWN_ERROR");
      expect(e.message).toBe("oops");
    });

    it("classifica unknown vuoto con messaggio default", () => {
      const e = ApiError.from(undefined);
      expect(e.code).toBe("UNKNOWN_ERROR");
      expect(e.message).toBe("Errore sconosciuto");
    });

    it("propaga il context nei details", () => {
      const e = ApiError.from(new Error("x"), "wcaDiscover");
      expect(e.details).toEqual({ context: "wcaDiscover" });
    });
  });

  describe("ApiError.fromResponse", () => {
    function mockResponse(status: number, body?: unknown): Response {
      const json = body !== undefined ? JSON.stringify(body) : "";
      return new Response(json, {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }

    it("401 → UNAUTHENTICATED", async () => {
      const e = await ApiError.fromResponse(mockResponse(401));
      expect(e.code).toBe("UNAUTHENTICATED");
      expect(e.httpStatus).toBe(401);
    });

    it("403 → FORBIDDEN", async () => {
      const e = await ApiError.fromResponse(mockResponse(403));
      expect(e.code).toBe("FORBIDDEN");
    });

    it("404 → NOT_FOUND", async () => {
      const e = await ApiError.fromResponse(mockResponse(404));
      expect(e.code).toBe("NOT_FOUND");
    });

    it("422 → VALIDATION_FAILED", async () => {
      const e = await ApiError.fromResponse(mockResponse(422));
      expect(e.code).toBe("VALIDATION_FAILED");
    });

    it("429 → RATE_LIMITED", async () => {
      const e = await ApiError.fromResponse(mockResponse(429));
      expect(e.code).toBe("RATE_LIMITED");
    });

    it("500/502/503 → SERVER_ERROR", async () => {
      expect((await ApiError.fromResponse(mockResponse(500))).code).toBe("SERVER_ERROR");
      expect((await ApiError.fromResponse(mockResponse(502))).code).toBe("SERVER_ERROR");
      expect((await ApiError.fromResponse(mockResponse(503))).code).toBe("SERVER_ERROR");
    });

    it("418 → UNKNOWN_ERROR (default)", async () => {
      const e = await ApiError.fromResponse(mockResponse(418));
      expect(e.code).toBe("UNKNOWN_ERROR");
    });

    it("estrae 'error' dal body JSON", async () => {
      const e = await ApiError.fromResponse(mockResponse(422, { error: "campo X mancante" }));
      expect(e.message).toBe("campo X mancante");
    });

    it("estrae 'message' dal body JSON se 'error' assente", async () => {
      const e = await ApiError.fromResponse(mockResponse(500, { message: "boom" }));
      expect(e.message).toBe("boom");
    });

    it("conserva l'intero body JSON nei details", async () => {
      const e = await ApiError.fromResponse(
        mockResponse(422, { error: "x", field: "email", code: "EMPTY" })
      );
      expect(e.details?.field).toBe("email");
      expect(e.details?.code).toBe("EMPTY");
    });

    it("body non-JSON → message default 'HTTP <status>'", async () => {
      const r = new Response("not json", { status: 500 });
      const e = await ApiError.fromResponse(r);
      expect(e.message).toBe("HTTP 500");
    });

    it("propaga il context nei details", async () => {
      const e = await ApiError.fromResponse(mockResponse(500), "wcaScrape");
      expect(e.details?.context).toBe("wcaScrape");
    });
  });
});
