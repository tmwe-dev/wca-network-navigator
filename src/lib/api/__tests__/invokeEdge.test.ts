import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/apiError";

const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: { addBreadcrumb: vi.fn(), captureException: vi.fn() },
}));

vi.mock("@/lib/api/costTracker", () => ({
  checkBudget: vi.fn(),
  trackCost: vi.fn(() => false),
}));

vi.mock("@/lib/api/responseValidator", () => ({
  validateResponse: vi.fn((data: unknown) => data),
}));

import { invokeEdge } from "@/lib/api/invokeEdge";

beforeEach(() => vi.clearAllMocks());

describe("invokeEdge", () => {
  it("returns data on success", async () => {
    mockInvoke.mockResolvedValue({ data: { result: "ok" }, error: null });
    const data = await invokeEdge("my-fn", { body: { x: 1 }, context: "test" });
    expect(data).toEqual({ result: "ok" });
    expect(mockInvoke).toHaveBeenCalledWith("my-fn", expect.objectContaining({ body: { x: 1 } }));
  });

  it("throws ApiError on supabase error with status 401", async () => {
    const errResponse = new Response(JSON.stringify({ error: "not authed" }), { status: 401 });
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "Unauthorized", context: errResponse, status: 401 },
    });
    await expect(invokeEdge("fn", { context: "t" })).rejects.toThrow(ApiError);
    try {
      await invokeEdge("fn", { context: "t" });
    } catch (e) {
      expect((e as ApiError).code).toBe("UNAUTHENTICATED");
    }
  });

  it("throws ApiError on supabase error with status 500", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "Server Error", status: 500 },
    });
    await expect(invokeEdge("fn", { context: "t" })).rejects.toThrow(ApiError);
    try {
      await invokeEdge("fn", { context: "t" });
    } catch (e) {
      expect((e as ApiError).code).toBe("SERVER_ERROR");
    }
  });

  it("throws ApiError wrapping network errors", async () => {
    mockInvoke.mockRejectedValue(new TypeError("fetch failed"));
    await expect(invokeEdge("fn", { context: "t" })).rejects.toThrow(ApiError);
    try {
      await invokeEdge("fn", { context: "t" });
    } catch (e) {
      expect((e as ApiError).code).toBe("NETWORK_ERROR");
    }
  });

  it("tracks cost when _debug.credits_consumed present", async () => {
    const { trackCost } = await import("@/lib/api/costTracker");
    mockInvoke.mockResolvedValue({
      data: { ok: true, _debug: { credits_consumed: 5 } },
      error: null,
    });
    await invokeEdge("ai-fn", { context: "t" });
    expect(trackCost).toHaveBeenCalledWith("ai-fn", 5);
  });

  it("validates response schema when provided", async () => {
    const { validateResponse } = await import("@/lib/api/responseValidator");
    mockInvoke.mockResolvedValue({ data: { name: "test" }, error: null });
    const schema = { required: { name: "string" as const } };
    await invokeEdge("fn", { context: "t", responseSchema: schema });
    expect(validateResponse).toHaveBeenCalledWith({ name: "test" }, schema);
  });
});
