import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const MOCK_ROWS = [
  { id: "e1", subject: "Re: Partnership", from_address: "john@acme.com", email_date: "2024-06-01T10:00:00Z", created_at: "2024-06-01T10:01:00Z" },
  { id: "e2", subject: null, from_address: null, email_date: null, created_at: "2024-06-02T08:00:00Z" },
];

const mockLimit = vi.fn().mockReturnValue({ data: MOCK_ROWS, error: null });
const mockOrder2 = vi.fn().mockReturnValue({ limit: mockLimit });
const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

const channelSubs: Array<{ callback: (payload: unknown) => void }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: (...a: unknown[]) => mockSelect(...a) }),
    channel: () => ({
      on: (_: string, __: unknown, cb: (payload: unknown) => void) => {
        channelSubs.push({ callback: cb });
        return { subscribe: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis() };
      },
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

import { useDownloadedEmailsFeed } from "./useDownloadedEmailsFeed";

beforeEach(() => {
  vi.clearAllMocks();
  channelSubs.length = 0;
});

describe("useDownloadedEmailsFeed", () => {
  it("returns loading then emails", async () => {
    const { result } = renderHookWithProviders(() => useDownloadedEmailsFeed());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.emails).toHaveLength(2);
  });

  it("maps subject fallback for null subject", async () => {
    const { result } = renderHookWithProviders(() => useDownloadedEmailsFeed());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.emails[1].subject).toBe("(senza oggetto)");
  });

  it("maps from_address to from field", async () => {
    const { result } = renderHookWithProviders(() => useDownloadedEmailsFeed());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.emails[0].from).toBe("john@acme.com");
    expect(result.current.emails[1].from).toBe("");
  });

  it("uses email_date with created_at fallback", async () => {
    const { result } = renderHookWithProviders(() => useDownloadedEmailsFeed());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.emails[0].date).toBe("2024-06-01T10:00:00Z");
    expect(result.current.emails[1].date).toBe("2024-06-02T08:00:00Z");
  });

  it("handles DB error", async () => {
    mockLimit.mockReturnValueOnce({ data: null, error: { message: "timeout" } });
    const { result } = renderHookWithProviders(() => useDownloadedEmailsFeed());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.emails).toEqual([]);
  });

  it("filters by channel=email", async () => {
    renderHookWithProviders(() => useDownloadedEmailsFeed());
    await waitFor(() => expect(mockEq).toHaveBeenCalled());
    expect(mockEq).toHaveBeenCalledWith("channel", "email");
  });
});
