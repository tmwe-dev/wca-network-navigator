import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockCallCheckInbox = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn().mockReturnValue({ error: null });

vi.mock("@/lib/checkInbox", () => ({
  callCheckInbox: (...args: unknown[]) => mockCallCheckInbox(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (...a: unknown[]) => {
        mockUpdate(...a);
        return { eq: mockUpdateEq };
      },
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
      }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useCheckInbox, useResetSync } from "./useEmailSync";

beforeEach(() => vi.clearAllMocks());

describe("useCheckInbox", () => {
  it("calls callCheckInbox and dispatches event on success", async () => {
    mockCallCheckInbox.mockResolvedValue({ total: 5, matched: 3 });
    const spy = vi.spyOn(window, "dispatchEvent");

    const { result } = renderHookWithProviders(() => useCheckInbox());
    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCallCheckInbox).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "channel-sync-done" })
    );
    spy.mockRestore();
  });

  it("shows error toast on failure", async () => {
    mockCallCheckInbox.mockRejectedValue(new Error("IMAP timeout"));
    const { toast } = await import("sonner");

    const { result } = renderHookWithProviders(() => useCheckInbox());
    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("IMAP timeout"));
  });

  it("handles zero new emails", async () => {
    mockCallCheckInbox.mockResolvedValue({ total: 0, matched: 0 });
    const { result } = renderHookWithProviders(() => useCheckInbox());
    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("handles non-standard response shape", async () => {
    mockCallCheckInbox.mockResolvedValue({ status: "ok" });
    const { result } = renderHookWithProviders(() => useCheckInbox());
    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useResetSync", () => {
  it("resets last_uid to 0", async () => {
    const { result } = renderHookWithProviders(() => useResetSync());
    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdate).toHaveBeenCalledWith({ last_uid: 0, stored_uidvalidity: null });
  });

  it("shows error toast on failure", async () => {
    mockUpdateEq.mockReturnValueOnce({ error: { message: "RLS denied" } });
    const { result } = renderHookWithProviders(() => useResetSync());
    await act(async () => { result.current.mutate(); });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
