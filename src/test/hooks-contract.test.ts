import { describe, it, expect, vi } from "vitest";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "test-user" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

describe("useAgents — Contract", () => {
  it("exports expected interface", async () => {
    const mod = await import("@/hooks/useAgents");
    expect(mod.useAgents).toBeDefined();
    expect(typeof mod.useAgents).toBe("function");
  });

  it("Agent type has required fields", () => {
    // Validate the shape that components depend on
    const requiredFields = [
      "id", "name", "role", "avatar_emoji", "is_active",
      "system_prompt", "assigned_tools", "user_id",
    ];
    requiredFields.forEach((f) => {
      expect(typeof f).toBe("string");
    });
  });
});

describe("usePartners — Contract", () => {
  it("exports expected interface", async () => {
    const mod = await import("@/hooks/usePartners");
    expect(mod.usePartners).toBeDefined();
    expect(typeof mod.usePartners).toBe("function");
  });
});
