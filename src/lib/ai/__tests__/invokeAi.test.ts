import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn(),
}));
vi.mock("@/v2/observability/traceCollector", () => ({
  traceCollector: {
    startCorrelation: vi.fn().mockReturnValue("corr-1"),
    push: vi.fn(),
    endCorrelation: vi.fn(),
  },
}));
vi.mock("@/lib/sentry", () => ({ Sentry: { captureException: vi.fn() } }));
vi.mock("@/data/aiInteractionLog", () => ({ logAiInteraction: vi.fn() }));

import { invokeAi, AI_FUNCTION_NAMES } from "../invokeAi";
import { invokeEdge } from "@/lib/api/invokeEdge";

const mockedInvokeEdge = vi.mocked(invokeEdge);

const validOptions = {
  scope: "outreach" as const,
  context: { source: "TestComponent", route: "/test", mode: "generate" },
  body: { prompt: "Hello" },
};

describe("invokeAi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvokeEdge.mockResolvedValue({ answer: "ok" });
  });

  it("throws when scope is missing", async () => {
    await expect(
      invokeAi("ai-assistant", {
        ...validOptions,
        scope: "" as any,
      }),
    ).rejects.toThrow("scope obbligatorio");
  });

  it("throws when context.source is missing", async () => {
    await expect(
      invokeAi("ai-assistant", {
        ...validOptions,
        context: { source: "" },
      }),
    ).rejects.toThrow("context.source obbligatorio");
  });

  it("enriches body with scope and context", async () => {
    await invokeAi("ai-assistant", validOptions);

    const callBody = mockedInvokeEdge.mock.calls[0][1]?.body as Record<string, any>;
    expect(callBody.scope).toBe("outreach");
    expect(callBody.context).toEqual({
      source: "TestComponent",
      route: "/test",
      mode: "generate",
      extra: undefined,
    });
    expect(callBody.prompt).toBe("Hello");
  });

  it("calls invokeEdge with the correct function name", async () => {
    await invokeAi("generate-email", validOptions);

    expect(mockedInvokeEdge).toHaveBeenCalledTimes(1);
    expect(mockedInvokeEdge.mock.calls[0][0]).toBe("generate-email");
  });

  it("returns the response from invokeEdge", async () => {
    mockedInvokeEdge.mockResolvedValueOnce({ draft: "Generated email" });

    const result = await invokeAi("generate-email", validOptions);

    expect(result).toEqual({ draft: "Generated email" });
  });

  it("re-throws errors from invokeEdge", async () => {
    mockedInvokeEdge.mockRejectedValueOnce(new Error("Edge failed"));

    await expect(invokeAi("ai-assistant", validOptions)).rejects.toThrow("Edge failed");
  });

  it("AI_FUNCTION_NAMES is a non-empty Set", () => {
    expect(AI_FUNCTION_NAMES).toBeInstanceOf(Set);
    expect(AI_FUNCTION_NAMES.size).toBeGreaterThan(0);
    expect(AI_FUNCTION_NAMES.has("ai-assistant")).toBe(true);
    expect(AI_FUNCTION_NAMES.has("generate-email")).toBe(true);
  });
});
