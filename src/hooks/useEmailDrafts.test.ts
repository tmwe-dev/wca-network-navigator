import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const MOCK_DRAFTS = [
  { id: "d1", subject: "Test Draft", html_body: "<p>Hello</p>", category: null, recipient_type: "all", recipient_filter: {}, attachment_ids: [], link_urls: [], status: "draft", sent_count: 0, total_count: 0, created_at: "2024-01-01", sent_at: null },
  { id: "d2", subject: "Second", html_body: null, category: "promo", recipient_type: "country", recipient_filter: { country: "IT" }, attachment_ids: [], link_urls: [], status: "sent", sent_count: 50, total_count: 100, created_at: "2024-01-02", sent_at: "2024-01-03" },
];

const mockOrder = vi.fn().mockReturnValue({ data: MOCK_DRAFTS, error: null });
const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
const mockInsertSelect = vi.fn().mockReturnValue({ single: vi.fn().mockReturnValue({ data: { id: "new-1" }, error: null }) });
const mockInsert = vi.fn().mockReturnValue({ select: () => mockInsertSelect() });
const mockUpdateEq = vi.fn().mockReturnValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...a: unknown[]) => mockSelect(...a),
      insert: (...a: unknown[]) => mockInsert(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    }),
  },
}));

import { useEmailDrafts, useSaveEmailDraft } from "./useEmailDrafts";

beforeEach(() => vi.clearAllMocks());

describe("useEmailDrafts", () => {
  it("returns loading then drafts", async () => {
    const { result } = renderHookWithProviders(() => useEmailDrafts());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].subject).toBe("Test Draft");
  });

  it("orders by created_at descending", async () => {
    renderHookWithProviders(() => useEmailDrafts());
    await waitFor(() => expect(mockOrder).toHaveBeenCalled());
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("handles empty result set", async () => {
    mockOrder.mockReturnValueOnce({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useEmailDrafts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it("handles DB error", async () => {
    mockOrder.mockReturnValueOnce({ data: null, error: { message: "Table missing" } });
    const { result } = renderHookWithProviders(() => useEmailDrafts());
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});

describe("useSaveEmailDraft", () => {
  it("calls insert for new draft without id", async () => {
    const { result } = renderHookWithProviders(() => useSaveEmailDraft());
    await act(async () => {
      result.current.mutate({ subject: "New Draft", recipient_type: "all" });
    });
    await waitFor(() => expect(mockInsert).toHaveBeenCalled());
  });

  it("calls update for existing draft with id", async () => {
    const { result } = renderHookWithProviders(() => useSaveEmailDraft());
    await act(async () => {
      result.current.mutate({ id: "d1", subject: "Updated" });
    });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "d1");
  });
});
