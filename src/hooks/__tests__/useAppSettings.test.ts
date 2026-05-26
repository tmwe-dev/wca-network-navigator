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

import { useAppSettings } from "../useAppSettings";
import { supabase } from "@/integrations/supabase/client";

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
});

function setupFromChain(finalResult: unknown) {
  // The source does: supabase.from("app_settings").select("key, value").eq("user_id", user.id)
  const mockEq = vi.fn().mockResolvedValue(finalResult);
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
  return { mockSelect, mockEq };
}

describe("useAppSettings", () => {
  it("loads settings as key-value map", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as unknown);
    setupFromChain({
      data: [
        { key: "theme", value: "dark" },
        { key: "lang", value: "it" },
      ],
      error: null,
    });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ theme: "dark", lang: "it" });
  });

  it("returns empty object when user not authenticated", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(null) as unknown);
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({});
  });

  it("returns empty object when no settings exist", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as unknown);
    setupFromChain({ data: [], error: null });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({});
  });

  it("throws on supabase error", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as unknown);
    setupFromChain({ data: null, error: { message: "DB error" } });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("has staleTime of 5 minutes", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as unknown);
    setupFromChain({ data: [], error: null });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isStale).toBe(false);
  });

  it("exposes loading state", () => {
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}) as unknown);
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
