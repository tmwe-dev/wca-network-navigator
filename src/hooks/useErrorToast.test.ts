import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockToast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("@/lib/errors", () => ({
  extractErrorMessage: (e: unknown) => e instanceof Error ? e.message : String(e),
}));

import { useErrorToast } from "./useErrorToast";

beforeEach(() => vi.clearAllMocks());

describe("useErrorToast", () => {
  it("calls toast with destructive variant", () => {
    const { result } = renderHookWithProviders(() => useErrorToast());
    result.current.showError("Something failed");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Something failed", variant: "destructive" })
    );
  });
  it("includes error description from Error object", () => {
    const { result } = renderHookWithProviders(() => useErrorToast());
    result.current.showError("Upload failed", new Error("Network timeout"));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Network timeout" })
    );
  });
  it("includes error description from string", () => {
    const { result } = renderHookWithProviders(() => useErrorToast());
    result.current.showError("Error", "Custom message");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Custom message" })
    );
  });
  it("omits description when no error provided", () => {
    const { result } = renderHookWithProviders(() => useErrorToast());
    result.current.showError("Title only");
    const call = mockToast.mock.calls[0][0];
    expect(call.description).toBeUndefined();
  });
  it("returns stable showError function", () => {
    const { result, rerender } = renderHookWithProviders(() => useErrorToast());
    const fn1 = result.current.showError;
    rerender();
    expect(result.current.showError).toBe(fn1);
  });
});
