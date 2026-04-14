import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
  },
}));

import { useSystemHealth } from "./useSystemHealth";

beforeEach(() => vi.clearAllMocks());

describe("useSystemHealth", () => {
  it("returns healthy status on success", async () => {
    mockInvoke.mockResolvedValue({
      data: { status: "healthy", checks: { db: "ok", auth: "ok" }, timestamp: "2024-06-01T00:00:00Z" },
      error: null,
    });
    const { result } = renderHookWithProviders(() => useSystemHealth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.status).toBe("healthy");
    expect(result.current.data?.checks.db).toBe("ok");
  });
  it("calls health-check edge function", async () => {
    mockInvoke.mockResolvedValue({ data: { status: "healthy", checks: {}, timestamp: "" }, error: null });
    renderHookWithProviders(() => useSystemHealth());
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("health-check"));
  });
  it("returns degraded status", async () => {
    mockInvoke.mockResolvedValue({
      data: { status: "degraded", checks: { db: "ok", email: "fail" }, timestamp: "2024-06-01" },
      error: null,
    });
    const { result } = renderHookWithProviders(() => useSystemHealth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.status).toBe("degraded");
    expect(result.current.data?.checks.email).toBe("fail");
  });
  it("handles edge function error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "Function not found" } });
    const { result } = renderHookWithProviders(() => useSystemHealth());
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
  it("handles network error", async () => {
    mockInvoke.mockRejectedValue(new Error("Network error"));
    const { result } = renderHookWithProviders(() => useSystemHealth());
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
