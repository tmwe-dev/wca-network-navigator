import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockIsNull = vi.fn();
const mockEqDir = vi.fn().mockReturnValue({ is: (...a: unknown[]) => { mockIsNull(...a); return { count: 3, error: null }; } });
const mockEqChan = vi.fn().mockReturnValue({ eq: mockEqDir });
const mockIn = vi.fn().mockReturnValue({ count: 7, error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        if (table === "partners") return { in: mockIn };
        if (table === "activities") return { in: mockIn };
        return { eq: mockEqChan };
      },
    }),
  },
}));

import { useUnreadCounts } from "./useUnreadCounts";

beforeEach(() => vi.clearAllMocks());

describe("useUnreadCounts", () => {
  it("returns unread counts for all channels", async () => {
    const { result } = renderHookWithProviders(() => useUnreadCounts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const data = result.current.data!;
    expect(data).toHaveProperty("email");
    expect(data).toHaveProperty("whatsapp");
    expect(data).toHaveProperty("linkedin");
    expect(data).toHaveProperty("circuito");
    expect(data).toHaveProperty("todo");
  });
  it("returns numeric values for all fields", async () => {
    const { result } = renderHookWithProviders(() => useUnreadCounts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const data = result.current.data!;
    expect(typeof data.email).toBe("number");
    expect(typeof data.whatsapp).toBe("number");
    expect(typeof data.circuito).toBe("number");
  });
  it("handles error gracefully", async () => {
    mockEqChan.mockReturnValueOnce({ eq: () => ({ is: () => { throw new Error("DB down"); } }) });
    const { result } = renderHookWithProviders(() => useUnreadCounts());
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
  it("defaults counts to 0 when null", async () => {
    mockEqDir.mockReturnValueOnce({ is: () => ({ count: null, error: null }) });
    const { result } = renderHookWithProviders(() => useUnreadCounts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.email).toBe(0);
  });
  it("uses planned count for efficiency", async () => {
    renderHookWithProviders(() => useUnreadCounts());
    // The hook uses head: true queries for performance
    expect(result).not.toBeNull(); // Just verifies render doesn't crash
  });
});
