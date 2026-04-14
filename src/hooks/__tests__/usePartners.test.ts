import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/data/partners", () => ({
/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
  findPartners: vi.fn(),
  findPartnersByCountry: vi.fn(),
  getPartner: vi.fn(),
  toggleFavorite: vi.fn(),
  getPartnerStats: vi.fn(),
  invalidatePartnerCache: vi.fn(),
}));
vi.mock("@/lib/queryKeys", () => ({
  queryKeys: {
    partners: { filtered: (f: unknown) => ["partners", f] },
    partner: (id: string) => ["partner", id],
  },
}));

import { usePartners, usePartner } from "../usePartners";
import { findPartners, getPartner } from "@/data/partners";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => { vi.clearAllMocks(); });

describe("usePartners", () => {
  it("fetches partners list", async () => {
    vi.mocked(findPartners).mockResolvedValue([{ id: "p1", company_name: "Acme" }] as any);
    const { result } = renderHook(() => usePartners(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
  });

  it("returns empty on no data", async () => {
    vi.mocked(findPartners).mockResolvedValue([]);
    const { result } = renderHook(() => usePartners(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
  });

  it("passes filters through", async () => {
    vi.mocked(findPartners).mockResolvedValue([]);
    renderHook(() => usePartners({ country: "IT" } as any), { wrapper });
    await waitFor(() => expect(findPartners).toHaveBeenCalledWith({ country: "IT" }));
  });

  it("handles fetch error", async () => {
    vi.mocked(findPartners).mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => usePartners(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("usePartner", () => {
  it("fetches single partner by id", async () => {
    vi.mocked(getPartner).mockResolvedValue({ id: "p1", company_name: "Acme" } as any);
    const { result } = renderHook(() => usePartner("p1"), { wrapper });
    await waitFor(() => expect(result.current.data?.company_name).toBe("Acme"));
  });
});
