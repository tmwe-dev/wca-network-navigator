import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "@/test/hookTestUtils";

const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockMaybeSingle(),
        }),
      }),
    }),
  },
}));

import { useEmailMessageContent } from "./useEmailMessageContent";

beforeEach(() => vi.clearAllMocks());

describe("useEmailMessageContent", () => {
  it("does not fetch when messageId is null", () => {
    const { result } = renderHookWithProviders(() => useEmailMessageContent(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.bodyHtml).toBeNull();
    expect(result.current.bodyText).toBeNull();
  });

  it("returns DB content on success", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { body_html: "<p>Ciao</p>", body_text: "Ciao" },
      error: null,
    });
    const { result } = renderHookWithProviders(() => useEmailMessageContent("msg-1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bodyHtml).toBe("<p>Ciao</p>");
    expect(result.current.bodyText).toBe("Ciao");
  });

  it("falls back to initial content when DB returns null", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHookWithProviders(() =>
      useEmailMessageContent("msg-2", { bodyHtml: "<p>Fallback</p>", bodyText: "Fallback" })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bodyHtml).toBe("<p>Fallback</p>");
    expect(result.current.bodyText).toBe("Fallback");
  });

  it("handles DB error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "Not found" } });
    const { result } = renderHookWithProviders(() => useEmailMessageContent("msg-3"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("returns null when no initial content and DB returns partial", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { body_html: null, body_text: "Text only" },
      error: null,
    });
    const { result } = renderHookWithProviders(() => useEmailMessageContent("msg-4"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bodyHtml).toBeNull();
    expect(result.current.bodyText).toBe("Text only");
  });
});
