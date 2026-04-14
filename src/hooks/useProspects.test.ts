import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const MOCK_PROSPECTS = [
  { id: "pr1", company_name: "Alpha Corp", country: "US", status: "new", created_at: "2024-01-01" },
  { id: "pr2", company_name: "Beta Ltd", country: "UK", status: "qualified", created_at: "2024-02-01" },
];

const mockOrder = vi.fn().mockReturnValue({ data: MOCK_PROSPECTS, error: null });
const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: (...a: unknown[]) => mockSelect(...a) }),
  },
}));

import { useProspects } from "./useProspects";

beforeEach(() => vi.clearAllMocks());

describe("useProspects", () => {
  it("returns prospects ordered by company_name", async () => {
    const { result } = renderHookWithProviders(() => useProspects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].company_name).toBe("Alpha Corp");
  });
  it("orders by company_name", async () => {
    renderHookWithProviders(() => useProspects());
    await waitFor(() => expect(mockOrder).toHaveBeenCalledWith("company_name"));
  });
  it("handles empty result", async () => {
    mockOrder.mockReturnValueOnce({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useProspects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
  it("handles null data", async () => {
    mockOrder.mockReturnValueOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useProspects());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
  it("handles DB error", async () => {
    mockOrder.mockReturnValueOnce({ data: null, error: { message: "timeout" } });
    const { result } = renderHookWithProviders(() => useProspects());
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
