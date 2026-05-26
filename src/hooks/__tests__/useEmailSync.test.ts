import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mockUpdate = vi.fn();
const mockEq = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(() => ({ update: mockUpdate })),
  },
}));
vi.mock("@/lib/checkInbox", () => ({ callCheckInbox: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { useResetSync, useCheckInbox } from "../useEmailSync";
import { supabase } from "@/integrations/supabase/client";
import { callCheckInbox } from "@/lib/checkInbox";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockReturnValue({ eq: mockEq });
});

describe("useResetSync", () => {
  it("exposes mutateAsync function", () => {
    const { result } = renderHook(() => useResetSync(), { wrapper });
    expect(typeof result.current.mutateAsync).toBe("function");
  });

  it("throws when not authenticated", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
    const { result } = renderHook(() => useResetSync(), { wrapper });
    await expect(result.current.mutateAsync()).rejects.toThrow("Non autenticato");
  });
});

describe("useCheckInbox", () => {
  it("exposes mutateAsync function", () => {
    const { result } = renderHook(() => useCheckInbox(), { wrapper });
    expect(typeof result.current.mutateAsync).toBe("function");
  });

  it("calls callCheckInbox on mutate", async () => {
    vi.mocked(callCheckInbox).mockResolvedValue({ total: 5, matched: 3 });
    const { result } = renderHook(() => useCheckInbox(), { wrapper });
    await result.current.mutateAsync();
    expect(callCheckInbox).toHaveBeenCalled();
  });
});
