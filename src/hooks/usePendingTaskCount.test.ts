import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockIn = vi.fn().mockReturnValue({ count: 5, error: null });
const mockEq = vi.fn().mockReturnValue({ in: mockIn });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: (...a: unknown[]) => mockSelect(...a) }),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
        error: null,
      }),
    },
    channel: () => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

import { usePendingTaskCount } from "./usePendingTaskCount";

beforeEach(() => vi.clearAllMocks());

describe("usePendingTaskCount", () => {
  it("returns count of pending tasks", async () => {
    const { result } = renderHookWithProviders(() => usePendingTaskCount());
    await waitFor(() => expect(result.current).toBe(5));
  });
  it("returns 0 when no user", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const { result } = renderHookWithProviders(() => usePendingTaskCount());
    await waitFor(() => expect(result.current).toBe(0));
  });
  it("returns 0 on DB error", async () => {
    mockIn.mockReturnValueOnce({ count: null, error: { message: "fail" } });
    const { result } = renderHookWithProviders(() => usePendingTaskCount());
    await waitFor(() => expect(result.current).toBe(0));
  });
  it("queries agent_tasks with correct filters", async () => {
    renderHookWithProviders(() => usePendingTaskCount());
    await waitFor(() => expect(mockSelect).toHaveBeenCalledWith("id", { count: "exact", head: true }));
    expect(mockEq).toHaveBeenCalledWith("user_id", "test-user");
    expect(mockIn).toHaveBeenCalledWith("status", ["pending", "proposed"]);
  });
  it("sets up realtime subscription on mount", async () => {
    const mod = await import("@/integrations/supabase/client");
    const channelSpy = vi.spyOn(mod.supabase, "channel" as any);
    renderHookWithProviders(() => usePendingTaskCount());
    expect(channelSpy).toHaveBeenCalledWith("pending-tasks-badge");
    channelSpy.mockRestore();
  });
});
