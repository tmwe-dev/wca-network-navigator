import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockFindPartners = vi.fn();
const mockFindPartnersByCountry = vi.fn();
const mockGetPartner = vi.fn();
const mockToggleFavorite = vi.fn();
const mockGetPartnerStats = vi.fn();
const mockInvalidatePartnerCache = vi.fn();

vi.mock("@/data/partners", () => ({
  findPartners: (...args: unknown[]) => mockFindPartners(...args),
  findPartnersByCountry: (...args: unknown[]) => mockFindPartnersByCountry(...args),
  getPartner: (...args: unknown[]) => mockGetPartner(...args),
  toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
  getPartnerStats: (...args: unknown[]) => mockGetPartnerStats(...args),
  invalidatePartnerCache: (...args: unknown[]) => mockInvalidatePartnerCache(...args),
}));

vi.mock("@/lib/queryKeys", () => ({
  queryKeys: {
    partners: {
      filtered: (f: unknown) => ["partners", f],
      byCountry: (code: string | null) => ["partners-by-country", code],
    },
    partner: (id: string) => ["partner", id],
    partnerStats: ["partner-stats"],
  },
}));

import { usePartners, usePartner, usePartnersByCountry, useToggleFavorite, usePartnerStats } from "./usePartners";

const MOCK_PARTNERS = [
  { id: "p1", company_name: "Acme Logistics", country_code: "IT", is_favorite: false },
  { id: "p2", company_name: "Beta Freight", country_code: "DE", is_favorite: true },
];
const MOCK_STATS = { total: 100, withEmail: 80, withPhone: 60, byCountry: { IT: 30, DE: 25 } };

beforeEach(() => {
  vi.clearAllMocks();
  mockFindPartners.mockResolvedValue(MOCK_PARTNERS);
  mockFindPartnersByCountry.mockResolvedValue([MOCK_PARTNERS[0]]);
  mockGetPartner.mockResolvedValue(MOCK_PARTNERS[0]);
  mockToggleFavorite.mockResolvedValue(undefined);
  mockGetPartnerStats.mockResolvedValue(MOCK_STATS);
});

describe("usePartners", () => {
  it("returns partners list", async () => {
    const { result } = renderHookWithProviders(() => usePartners());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(MOCK_PARTNERS);
    expect(mockFindPartners).toHaveBeenCalled();
  });

  it("passes filters to findPartners", async () => {
    const filters = { search: "Acme" };
    renderHookWithProviders(() => usePartners(filters));
    await waitFor(() => expect(mockFindPartners).toHaveBeenCalledWith(filters));
  });

  it("handles error from data layer", async () => {
    mockFindPartners.mockRejectedValueOnce(new Error("DB error"));
    const { result } = renderHookWithProviders(() => usePartners());
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});

describe("usePartner", () => {
  it("fetches single partner by id", async () => {
    const { result } = renderHookWithProviders(() => usePartner("p1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(MOCK_PARTNERS[0]);
    expect(mockGetPartner).toHaveBeenCalledWith("p1");
  });

  it("is disabled for empty id", () => {
    const { result } = renderHookWithProviders(() => usePartner(""));
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("usePartnersByCountry", () => {
  it("fetches partners for given country", async () => {
    const { result } = renderHookWithProviders(() => usePartnersByCountry("IT"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(mockFindPartnersByCountry).toHaveBeenCalledWith("IT");
  });

  it("is disabled for null country", () => {
    const { result } = renderHookWithProviders(() => usePartnersByCountry(null));
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useToggleFavorite", () => {
  it("calls toggleFavorite with correct args", async () => {
    const { result } = renderHookWithProviders(() => useToggleFavorite());
    await act(async () => {
      result.current.mutate({ id: "p1", isFavorite: true });
    });
    await waitFor(() => expect(mockToggleFavorite).toHaveBeenCalledWith("p1", true));
  });
});

describe("usePartnerStats", () => {
  it("returns stats object", async () => {
    const { result } = renderHookWithProviders(() => usePartnerStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(MOCK_STATS);
  });
});
