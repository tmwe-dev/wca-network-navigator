import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/data/partners", () => ({ getPartnersByIds: vi.fn().mockResolvedValue([]) }));
vi.mock("@/data/contacts", () => ({ getContactsByIds: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/queryKeys", () => ({ queryKeys: { partners: { all: ["p"] } } }));
vi.mock("@/hooks/useDeepSearchLocal", () => ({
  useDeepSearchLocal: () => ({
    runLocalSearch: vi.fn().mockResolvedValue({ success: false }),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) }));

import { useDeepSearchRunner } from "../useDeepSearchRunner";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useDeepSearchRunner", () => {
  it("initializes with running=false", () => {
    const { result } = renderHook(() => useDeepSearchRunner(), { wrapper });
    expect(result.current.running).toBe(false);
  });

  it("initializes with empty results", () => {
    const { result } = renderHook(() => useDeepSearchRunner(), { wrapper });
    expect(result.current.results).toEqual([]);
  });

  it("has canvasOpen=false initially", () => {
    const { result } = renderHook(() => useDeepSearchRunner(), { wrapper });
    expect(result.current.canvasOpen).toBe(false);
  });

  it("setCanvasOpen toggles canvas state", () => {
    const { result } = renderHook(() => useDeepSearchRunner(), { wrapper });
    act(() => result.current.setCanvasOpen(true));
    expect(result.current.canvasOpen).toBe(true);
  });

  it("exposes start and stop functions", () => {
    const { result } = renderHook(() => useDeepSearchRunner(), { wrapper });
    expect(typeof result.current.start).toBe("function");
    expect(typeof result.current.stop).toBe("function");
  });
});
