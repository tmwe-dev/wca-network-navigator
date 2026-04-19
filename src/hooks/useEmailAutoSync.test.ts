import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockMutate = vi.fn();
vi.mock("@/hooks/useChannelMessages", () => ({
  useCheckInbox: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: "u1" }, session: {} }),
}));

import { useEmailAutoSync } from "./useEmailAutoSync";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  try { localStorage.removeItem("email_auto_sync_enabled"); } catch {}
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useEmailAutoSync", () => {
  it("defaults to enabled when localStorage is empty", () => {
    const { result } = renderHookWithProviders(() => useEmailAutoSync());
    expect(result.current.enabled).toBe(true);
  });

  it("reads stored preference from localStorage", () => {
    localStorage.setItem("email_auto_sync_enabled", "false");
    const { result } = renderHookWithProviders(() => useEmailAutoSync());
    expect(result.current.enabled).toBe(false);
  });

  it("triggers immediate check when active", () => {
    renderHookWithProviders(() => useEmailAutoSync());
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("does NOT trigger check when paused", () => {
    renderHookWithProviders(() => useEmailAutoSync({ paused: true }));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("toggle flips enabled and persists to localStorage", () => {
    const { result } = renderHookWithProviders(() => useEmailAutoSync());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem("email_auto_sync_enabled")).toBe("false");
  });

  it("checkNow calls mutate directly", () => {
    const { result } = renderHookWithProviders(() => useEmailAutoSync());
    mockMutate.mockClear();
    act(() => result.current.checkNow());
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("periodic timer fires after interval", () => {
    renderHookWithProviders(() => useEmailAutoSync());
    mockMutate.mockClear();
    act(() => { vi.advanceTimersByTime(2 * 60 * 1000); });
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });
});
