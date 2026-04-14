import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
  supabase: {
    auth: { getUser: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("@/data/aiConversations", () => ({
  findConversations: vi.fn(),
  getConversation: vi.fn(),
  createConversation: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
}));

import { useAIConversation } from "../useAIConversation";
import { supabase } from "@/integrations/supabase/client";
import { findConversations } from "@/data/aiConversations";

const mockUser = { id: "user-1" };

beforeEach(() => { vi.clearAllMocks(); });

describe("useAIConversation", () => {
  it("initializes with empty messages", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    vi.mocked(findConversations).mockResolvedValue([]);
    const { result } = renderHook(() => useAIConversation("dashboard"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it("loads existing conversation on mount", async () => {
    const existing = { id: "c1", messages: [{ role: "user", content: "hi" }], title: "Test" };
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    vi.mocked(findConversations).mockResolvedValue([existing] as any);
    const { result } = renderHook(() => useAIConversation("dashboard"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.conversationId).toBe("c1");
  });

  it("shows loading=true initially", () => {
    vi.mocked(supabase.auth.getUser).mockReturnValue(new Promise(() => {}) as any);
    const { result } = renderHook(() => useAIConversation("test"));
    expect(result.current.loading).toBe(true);
  });

  it("handles unauthenticated user", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);
    const { result } = renderHook(() => useAIConversation("test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it("exposes addMessages function", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser as any }, error: null } as any);
    vi.mocked(findConversations).mockResolvedValue([]);
    const { result } = renderHook(() => useAIConversation("test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.addMessages).toBe("function");
  });
});
