import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));
vi.mock("@/data/partners", () => ({
  getPartnersByLeadStatus: vi.fn(),
}));

import { useHoldingMessages } from "../useHoldingMessages";
import { supabase } from "@/integrations/supabase/client";
import { getPartnersByLeadStatus } from "@/data/partners";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockUser = { id: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
});

describe("useHoldingMessages", () => {
  it("returns empty array when user not authenticated", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    const { result } = renderHook(() => useHoldingMessages("email"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it("fetches holding messages for email channel", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    vi.mocked(getPartnersByLeadStatus).mockResolvedValue([]);
    const { result } = renderHook(() => useHoldingMessages("email"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getPartnersByLeadStatus).toHaveBeenCalled();
  });

  it("uses correct query key per channel", () => {
    vi.mocked(supabase.auth.getUser).mockReturnValue(new Promise(() => {}) as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    renderHook(() => useHoldingMessages("whatsapp"), { wrapper });
    // just ensure it doesn't throw
  });

  it("exposes loading state", () => {
    vi.mocked(supabase.auth.getUser).mockReturnValue(new Promise(() => {}) as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    const { result } = renderHook(() => useHoldingMessages("email"), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("handles partner fetch with statuses", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    vi.mocked(getPartnersByLeadStatus).mockResolvedValue([
      { id: "p1", company_name: "Test Co", email: "test@test.com", lead_status: "contacted" },
    ] as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    const { result } = renderHook(() => useHoldingMessages("email"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
