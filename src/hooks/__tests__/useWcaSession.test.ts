import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@/lib/wcaCookieStore", () => ({ setWcaCookie: vi.fn() }));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useWcaSession } from "../useWcaSession";

beforeEach(() => { vi.clearAllMocks(); });

describe("useWcaSession", () => {
  it("initializes with sessionActive=null", () => {
    const { result } = renderHook(() => useWcaSession());
    expect(result.current.sessionActive).toBeNull();
  });

  it("sets sessionActive=true on successful login", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ success: true, cookies: "abc" }) });
    const { result } = renderHook(() => useWcaSession());
    let success: boolean = false;
    await act(async () => { success = await result.current.ensureSession(); });
    expect(success).toBe(true);
    expect(result.current.sessionActive).toBe(true);
  });

  it("sets sessionActive=false on failed login", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ success: false, error: "bad" }) });
    const { result } = renderHook(() => useWcaSession());
    await act(async () => { await result.current.ensureSession(); });
    expect(result.current.sessionActive).toBe(false);
    expect(result.current.lastError).toBe("bad");
  });

  it("handles network error gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useWcaSession());
    await act(async () => { await result.current.ensureSession(); });
    expect(result.current.sessionActive).toBe(false);
    expect(result.current.lastError).toBe("wca-app non raggiungibile");
  });
});
