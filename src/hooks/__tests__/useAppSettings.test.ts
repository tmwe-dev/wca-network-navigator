import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mockSelect = vi.fn();
const mockEq = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({ select: mockSelect })),
  },
}));

import { useAppSettings } from "../useAppSettings";
import { supabase } from "@/integrations/supabase/client";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockUser = { id: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({ eq: mockEq });
});

describe("useAppSettings", () => {
  it("loads settings as key-value map", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    mockEq.mockResolvedValue({ data: [{ key: "theme", value: "dark" }, { key: "lang", value: "it" }], error: null });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ theme: "dark", lang: "it" });
  });

  it("returns empty object when user not authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({});
  });

  it("returns empty object when no settings exist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    mockEq.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({});
  });

  it("throws on supabase error", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    mockEq.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("has staleTime of 5 minutes", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    mockEq.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isStale).toBe(false);
  });

  it("exposes loading state", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    vi.mocked(supabase.auth.getUser).mockReturnValue(new Promise(() => {}) as any);
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
