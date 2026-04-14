import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const MOCK_REMINDERS = [
  { id: "r1", partner_id: "p1", due_date: "2024-06-01", title: "Follow up", description: null, status: "pending", priority: "high", created_at: "2024-05-01", updated_at: null, partners: { company_name: "Acme", country_code: "IT" } },
  { id: "r2", partner_id: "p2", due_date: "2024-06-15", title: "Call", description: "Discuss rates", status: "completed", priority: "low", created_at: "2024-05-10", updated_at: null, partners: { company_name: "Beta", country_code: "DE" } },
];

const mockOrder = vi.fn().mockReturnValue({ data: MOCK_REMINDERS, error: null });
const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
const mockLimitOrder = vi.fn().mockReturnValue({ data: [MOCK_REMINDERS[0]], error: null });
const mockLimit = vi.fn().mockReturnValue(mockLimitOrder());
const mockEqOrder = vi.fn().mockReturnValue({ limit: mockLimit });
const mockEqSelect = vi.fn().mockReturnValue({ order: mockEqOrder });
const mockUpdateEq = vi.fn().mockReturnValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...a: unknown[]) => mockSelect(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    }),
  },
}));

import { useReminders, usePendingReminders, useCompleteReminder } from "./useReminders";

beforeEach(() => vi.clearAllMocks());

describe("useReminders", () => {
  it("returns all reminders ordered by due_date", async () => {
    const { result } = renderHookWithProviders(() => useReminders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].title).toBe("Follow up");
  });
  it("includes partner join data", async () => {
    const { result } = renderHookWithProviders(() => useReminders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data![0].partners?.company_name).toBe("Acme");
  });
  it("handles DB error", async () => {
    mockOrder.mockReturnValueOnce({ data: null, error: { message: "fail" } });
    const { result } = renderHookWithProviders(() => useReminders());
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
  it("handles empty result", async () => {
    mockOrder.mockReturnValueOnce({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useReminders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});

describe("useCompleteReminder", () => {
  it("updates status to completed", async () => {
    const { result } = renderHookWithProviders(() => useCompleteReminder());
    await act(async () => { result.current.mutate("r1"); });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ status: "completed" }));
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "r1");
  });
  it("handles update error", async () => {
    mockUpdateEq.mockReturnValueOnce({ error: { message: "RLS" } });
    const { result } = renderHookWithProviders(() => useCompleteReminder());
    await act(async () => { result.current.mutate("r1"); });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
