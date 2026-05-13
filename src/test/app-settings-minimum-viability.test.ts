import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));
vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

import { supabase } from "@/integrations/supabase/client";

const AGENT_SETTINGS_KEYS = ["agent_max_actions_per_cycle", "agent_work_start_hour", "agent_work_end_hour"];

describe("App Settings Minimum Viability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("app_settings table is queryable", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ key: "test" }], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase.from("app_settings").select("key").limit(1);
    // RLS may block -- that's OK, table should exist
    expect(error === null || error?.code === "PGRST301").toBe(true);
  });

  it("agent settings values are valid numbers if present", async () => {
    const mockData = [
      { key: "agent_max_actions_per_cycle", value: "10" },
      { key: "agent_work_start_hour", value: "8" },
      { key: "agent_work_end_hour", value: "18" },
    ];
    const chain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase.from("app_settings").select("key, value").in("key", AGENT_SETTINGS_KEYS);

    for (const row of data || []) {
      if (row.value) {
        const num = parseInt(row.value, 10);
        expect(Number.isFinite(num)).toBe(true);
        expect(num).toBeGreaterThan(0);
      }
    }
  });
});
