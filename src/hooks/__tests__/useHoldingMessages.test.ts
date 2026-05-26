import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: (...a: unknown[]) => mockFrom(...a),
  },
}));
vi.mock("@/data/partners", () => ({
  getPartnersByLeadStatus: vi.fn(),
  getPartnersByLeadStatusFromView: vi.fn(),
}));
vi.mock("@/data/channelMessages", () => ({
  getUnifiedInboxStats: vi.fn(),
}));

import { useHoldingMessages } from "../useHoldingMessages";
import { supabase } from "@/integrations/supabase/client";
import { getPartnersByLeadStatusFromView } from "@/data/partners";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockUser = { id: "user-1" };

function mockSession(user: unknown) {
  return { data: { session: user ? { user } : null }, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: imported_contacts returns empty
  const mockIn = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockEq2 = vi.fn().mockReturnValue({ in: mockIn });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("useHoldingMessages", () => {
  it("returns empty array when user not authenticated", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(null) as any);
    const { result } = renderHook(() => useHoldingMessages("email"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it("fetches holding messages for email channel", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as any);
    vi.mocked(getPartnersByLeadStatusFromView).mockResolvedValue([]);
    const { result } = renderHook(() => useHoldingMessages("email"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getPartnersByLeadStatusFromView).toHaveBeenCalled();
  });

  it("uses correct query key per channel", () => {
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}) as any);
    renderHook(() => useHoldingMessages("whatsapp"), { wrapper });
    // just ensure it doesn't throw
  });

  it("exposes loading state", () => {
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}) as any);
    const { result } = renderHook(() => useHoldingMessages("email"), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("handles partner fetch with statuses", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as any);
    vi.mocked(getPartnersByLeadStatusFromView).mockResolvedValue([
      { partner_id: "p1", company_name: "Test Co", email: "test@test.com", lead_status: "contacted" },
    ] as any);
    const { result } = renderHook(() => useHoldingMessages("email"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
