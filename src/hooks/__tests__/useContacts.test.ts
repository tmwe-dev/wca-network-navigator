import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/data/contacts", () => ({
  findContacts: vi.fn(),
  findHoldingPatternContacts: vi.fn(),
  getHoldingPatternStats: vi.fn(),
  getContactFilterOptions: vi.fn(),
  findContactInteractions: vi.fn(),
  updateLeadStatus: vi.fn(),
  createContactInteraction: vi.fn(),
  contactKeys: {
    all: ["contacts"],
    filtered: (f: unknown) => ["contacts", f],
    filterOptions: ["contacts", "filterOptions"],
    holdingPatternStats: ["contacts", "holdingStats"],
  },
  invalidateContactCache: vi.fn(),
}));

import { useContacts, useContactFilterOptions } from "../useContacts";
import { findContacts, getContactFilterOptions } from "@/data/contacts";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useContacts", () => {
  it("fetches contacts with default filters", async () => {
    vi.mocked(findContacts).mockResolvedValue({ items: [{ id: "c1" }], totalCount: 1, page: 1, pageSize: 50 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it("passes filters to findContacts", async () => {
    vi.mocked(findContacts).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    renderHook(() => useContacts({ country: "IT" }), { wrapper });
    await waitFor(() => expect(findContacts).toHaveBeenCalledWith({ country: "IT" }));
  });

  it("returns empty array when no contacts match", async () => {
    vi.mocked(findContacts).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    const { result } = renderHook(() => useContacts({ search: "xyz" }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.items).toEqual([]);
  });

  it("handles error from data layer", async () => {
    vi.mocked(findContacts).mockRejectedValue(new Error("DB fail"));
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("exposes loading state", () => {
    vi.mocked(findContacts).mockReturnValue(new Promise(() => {}) as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    const { result } = renderHook(() => useContacts(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("re-fetches when filters change", async () => {
    vi.mocked(findContacts).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    const { result, rerender } = renderHook(
      ({ f }) => useContacts(f),
      { wrapper, initialProps: { f: {} } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ f: { country: "DE" } });
    await waitFor(() => expect(findContacts).toHaveBeenCalledWith({ country: "DE" }));
  });
});

describe("useContactFilterOptions", () => {
  it("fetches filter options", async () => {
    vi.mocked(getContactFilterOptions).mockResolvedValue({ countries: ["IT", "DE"] } as any); // eslint-disable-line @typescript-eslint/no-explicit-any -- test mock
    const { result } = renderHook(() => useContactFilterOptions(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ countries: ["IT", "DE"] });
  });
});
