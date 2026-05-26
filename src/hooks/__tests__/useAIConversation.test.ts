import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
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

function mockSession(user: unknown) {
  return { data: { session: user ? { user } : null }, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAIConversation", () => {
  it("initializes with empty messages", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as unknown);
    vi.mocked(findConversations).mockResolvedValue([]);
    const { result } = renderHook(() => useAIConversation("dashboard"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it("loads existing conversation on mount", async () => {
    const existing = { id: "c1", messages: [{ role: "user", content: "hi" }], title: "Test" };
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as unknown);
    vi.mocked(findConversations).mockResolvedValue([existing] as unknown);
    const { result } = renderHook(() => useAIConversation("dashboard"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.conversationId).toBe("c1");
  });

  it("shows loading=true initially", () => {
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}) as unknown);
    const { result } = renderHook(() => useAIConversation("test"));
    expect(result.current.loading).toBe(true);
  });

  it("handles unauthenticated user", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(null) as unknown);
    const { result } = renderHook(() => useAIConversation("test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it("exposes addMessages function", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession(mockUser) as unknown);
    vi.mocked(findConversations).mockResolvedValue([]);
    const { result } = renderHook(() => useAIConversation("test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.addMessages).toBe("function");
  });
});
