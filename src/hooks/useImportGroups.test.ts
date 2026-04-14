import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const MOCK_LOGS = [
  { id: "l1", group_name: "Batch A", file_name: "contacts.csv", created_at: "2024-06-01", imported_rows: 100, status: "completed" },
  { id: "l2", group_name: null, file_name: "leads.xlsx", created_at: "2024-06-02", imported_rows: 50, status: "pending" },
  { id: "l3", group_name: "", file_name: null, created_at: "2024-06-03", imported_rows: 0, status: "error" },
];

const mockOrder = vi.fn().mockReturnValue({ data: MOCK_LOGS, error: null });
const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: (...a: unknown[]) => mockSelect(...a) }),
  },
}));

import { useImportGroups } from "./useImportGroups";

beforeEach(() => vi.clearAllMocks());

describe("useImportGroups", () => {
  it("returns groups with names", async () => {
    const { result } = renderHookWithProviders(() => useImportGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0].group_name).toBe("Batch A");
  });
  it("falls back to file_name without extension for null group_name", async () => {
    const { result } = renderHookWithProviders(() => useImportGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data![1].group_name).toBe("leads");
  });
  it("falls back to 'Senza nome' when both are empty", async () => {
    const { result } = renderHookWithProviders(() => useImportGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data![2].group_name).toBe("Senza nome");
  });
  it("orders by created_at descending", async () => {
    renderHookWithProviders(() => useImportGroups());
    await waitFor(() => expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false }));
  });
  it("handles DB error", async () => {
    mockOrder.mockReturnValueOnce({ data: null, error: { message: "fail" } });
    const { result } = renderHookWithProviders(() => useImportGroups());
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
