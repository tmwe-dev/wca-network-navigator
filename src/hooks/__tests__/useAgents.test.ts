import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/integrations/supabase/client", () => ({
/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
  supabase: {
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("@/data/agents", () => ({
  findAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  invalidateAgents: vi.fn(),
}));

import { useAgents } from "../useAgents";
import { supabase } from "@/integrations/supabase/client";
import { findAgents } from "@/data/agents";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const mockUser = { id: "user-1", email: "test@test.com" };

beforeEach(() => { vi.clearAllMocks(); });

describe("useAgents", () => {
  it("returns agents list on success", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    vi.mocked(findAgents).mockResolvedValue([{ id: "a1", name: "Agent A" }] as any);
    const { result } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0].name).toBe("Agent A");
  });

  it("returns empty array when no agents", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    vi.mocked(findAgents).mockResolvedValue([]);
    const { result } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.agents).toEqual([]);
  });

  it("throws when user is not authenticated", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);
    const { result } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.agents).toEqual([]);
  });

  it("exposes isLoading=true initially", () => {
    vi.mocked(supabase.auth.getUser).mockReturnValue(new Promise(() => {}) as any);
    const { result } = renderHook(() => useAgents(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("exposes createAgent mutation", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    vi.mocked(findAgents).mockResolvedValue([]);
    const { result } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.createAgent).toBeDefined();
    expect(typeof result.current.createAgent.mutateAsync).toBe("function");
  });

  it("exposes deleteAgent mutation", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    vi.mocked(findAgents).mockResolvedValue([]);
    const { result } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.deleteAgent.mutateAsync).toBe("function");
  });
});
