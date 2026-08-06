/**
 * useChannelMessagesV2 — B4.1 orchestration tests
 * Verifica: primaria view OK, fallback legacy quando la view fallisce.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const viewMock = vi.fn();
const legacyMock = vi.fn();

vi.mock("@/v2/io/supabase/queries/channel-messages", () => ({
  fetchChannelMessagesFromView: (...a: unknown[]) => viewMock(...a),
  fetchChannelMessages: (...a: unknown[]) => legacyMock(...a),
}));
vi.mock("@/v2/io/supabase/mutations/channel-messages", () => ({
  markMessageRead: vi.fn(),
}));

import { useChannelMessagesV2 } from "../useChannelMessagesV2";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe("useChannelMessagesV2 (B4.1 orchestration)", () => {
  beforeEach(() => {
    viewMock.mockReset();
    legacyMock.mockReset();
  });

  it("usa la view canonica quando ritorna Ok e NON chiama la legacy", async () => {
    viewMock.mockResolvedValue({ _tag: "Ok", value: [{ id: "v1" }] });
    const { result } = renderHook(() => useChannelMessagesV2("inbound", 50), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ id: "v1" }]);
    expect(viewMock).toHaveBeenCalledWith(50, "inbound");
    expect(legacyMock).not.toHaveBeenCalled();
  });

  it("fa fallback trasparente alla legacy quando la view ritorna Err", async () => {
    viewMock.mockResolvedValue({ _tag: "Err", error: { code: "DATABASE_ERROR", message: "boom" } });
    legacyMock.mockResolvedValue({ _tag: "Ok", value: [{ id: "legacy1" }] });
    const { result } = renderHook(() => useChannelMessagesV2(undefined, 25), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ id: "legacy1" }]);
    expect(legacyMock).toHaveBeenCalledWith(25, undefined);
  });
});
