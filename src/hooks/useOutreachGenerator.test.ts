import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockInvokeEdge = vi.fn();
vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: (...args: unknown[]) => mockInvokeEdge(...args),
}));

vi.mock("@/lib/api/apiError", () => ({
  isApiError: (e: unknown) => e instanceof Error && "code" in e,
  ApiError: class extends Error { code = "TEST"; },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

import { useOutreachGenerator } from "./useOutreachGenerator";

beforeEach(() => vi.clearAllMocks());

describe("useOutreachGenerator", () => {
  it("starts with idle state", () => {
    const { result } = renderHookWithProviders(() => useOutreachGenerator());
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it("generates and stores result on success", async () => {
    const outreach = {
      channel: "email",
      subject: "Partnership",
      body: "Dear Partner...",
      contact_name: "John",
      contact_email: "john@example.com",
      company_name: "Acme",
      language: "en",
    };
    mockInvokeEdge.mockResolvedValue(outreach);

    const { result } = renderHookWithProviders(() => useOutreachGenerator());
    let generated: unknown;
    await act(async () => {
      generated = await result.current.generate({
        channel: "email",
        contact_name: "John",
        company_name: "Acme",
      });
    });
    expect(generated).toEqual(outreach);
    expect(result.current.result).toEqual(outreach);
    expect(result.current.isGenerating).toBe(false);
  });

  it("returns null and toasts on error", async () => {
    mockInvokeEdge.mockRejectedValue(new Error("AI failed"));
    const { toast } = await import("@/hooks/use-toast");

    const { result } = renderHookWithProviders(() => useOutreachGenerator());
    let generated: unknown;
    await act(async () => {
      generated = await result.current.generate({
        channel: "email",
        contact_name: "X",
        company_name: "Y",
      });
    });
    expect(generated).toBeNull();
    expect(result.current.result).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("returns null when channel is empty", async () => {
    const { result } = renderHookWithProviders(() => useOutreachGenerator());
    let generated: unknown;
    await act(async () => {
      generated = await result.current.generate({
        channel: "" as any,
        contact_name: "X",
        company_name: "Y",
      });
    });
    expect(generated).toBeNull();
  });

  it("reset clears the result", async () => {
    mockInvokeEdge.mockResolvedValue({ channel: "email", subject: "S", body: "B", contact_name: null, contact_email: null, company_name: null, language: "en" });
    const { result } = renderHookWithProviders(() => useOutreachGenerator());
    await act(async () => {
      await result.current.generate({ channel: "email", contact_name: "A", company_name: "B" });
    });
    expect(result.current.result).not.toBeNull();
    act(() => result.current.reset());
    expect(result.current.result).toBeNull();
  });

  it("handles error in response body", async () => {
    mockInvokeEdge.mockResolvedValue({ error: "Credit limit exceeded" });
    const { result } = renderHookWithProviders(() => useOutreachGenerator());
    let generated: unknown;
    await act(async () => {
      generated = await result.current.generate({ channel: "email", contact_name: "A", company_name: "B" });
    });
    expect(generated).toBeNull();
  });
});
