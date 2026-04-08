/**
 * invokeEdge — copertura wrapper Edge Functions (Vol. II §5.3 + ADR-0001).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { ApiError, isApiError } from "@/lib/api/apiError";

const invokeMock = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe("invokeEdge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("ritorna data quando l'invocazione ha successo", async () => {
    invokeMock.mockResolvedValueOnce({ data: { foo: "bar" }, error: null });
    const out = await invokeEdge<{ foo: string }>("my-fn", { context: "test" });
    expect(out).toEqual({ foo: "bar" });
    expect(invokeMock).toHaveBeenCalledWith("my-fn", { body: undefined, headers: undefined });
  });

  it("propaga body e headers", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: null });
    await invokeEdge("my-fn", {
      body: { hello: "world" },
      headers: { "X-Test": "1" },
      context: "test",
    });
    expect(invokeMock).toHaveBeenCalledWith("my-fn", {
      body: { hello: "world" },
      headers: { "X-Test": "1" },
    });
  });

  it("converte exception in ApiError NETWORK_ERROR via ApiError.from", async () => {
    invokeMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    try {
      await invokeEdge("my-fn", { context: "ctxA" });
      throw new Error("expected throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("NETWORK_ERROR");
      expect(apiErr.details?.context).toBe("ctxA");
    }
  });

  it.each([
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [422, "VALIDATION_FAILED"],
    [429, "RATE_LIMITED"],
    [500, "SERVER_ERROR"],
    [503, "SERVER_ERROR"],
  ] as const)("mappa status %i → %s", async (status, expectedCode) => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "boom", context: { status }, name: "FunctionsHttpError" },
    });
    try {
      await invokeEdge("my-fn", { context: "ctxB" });
      throw new Error("expected throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe(expectedCode);
      expect(apiErr.httpStatus).toBe(status);
      expect(apiErr.message).toBe("boom");
      expect(apiErr.details?.functionName).toBe("my-fn");
      expect(apiErr.details?.context).toBe("ctxB");
    }
  });

  it("usa UNKNOWN_ERROR quando lo status non è disponibile", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "weird" },
    });
    try {
      await invokeEdge("my-fn", { context: "ctxC" });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as ApiError).code).toBe("UNKNOWN_ERROR");
      expect((err as ApiError).httpStatus).toBeUndefined();
    }
  });

  it("fallback messaggio se error.message assente", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: {} });
    try {
      await invokeEdge("my-fn", { context: "ctxD" });
      throw new Error("expected throw");
    } catch (err) {
      expect((err as ApiError).message).toContain("my-fn");
    }
  });
});
