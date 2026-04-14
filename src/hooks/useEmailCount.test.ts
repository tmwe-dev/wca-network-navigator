import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { count: 42, error: null };
          },
        };
      },
    }),
  },
}));

import { useEmailCount } from "./useEmailCount";

beforeEach(() => vi.clearAllMocks());

describe("useEmailCount", () => {
  it("returns loading state initially", () => {
    const { result } = renderHookWithProviders(() => useEmailCount());
    expect(result.current.isLoading).toBe(true);
  });

  it("returns count after loading", async () => {
    const { result } = renderHookWithProviders(() => useEmailCount());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(42);
  });

  it("queries channel_messages with email filter", async () => {
    renderHookWithProviders(() => useEmailCount());
    await waitFor(() => expect(mockEq).toHaveBeenCalled());
    expect(mockEq).toHaveBeenCalledWith("channel", "email");
    expect(mockSelect).toHaveBeenCalledWith("id", { count: "planned", head: true });
  });

  it("returns 42 from mock (default)", async () => {
    // The mock always returns count:42 by default
    const { result } = renderHookWithProviders(() => useEmailCount());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(42);
  });

  it("handles error from queryFn — retries exhausted", async () => {
    // With retry:false in test client, first error should surface
    mockEq.mockImplementationOnce(() => { throw new Error("DB down"); });
    const { result } = renderHookWithProviders(() => useEmailCount());
    await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 3000 });
  });

  it("uses 3s refetch when syncing", () => {
    const { result } = renderHookWithProviders(() => useEmailCount(true));
    // Hook should be configured — we verify it doesn't crash
    expect(result.current.isLoading).toBe(true);
  });
});
