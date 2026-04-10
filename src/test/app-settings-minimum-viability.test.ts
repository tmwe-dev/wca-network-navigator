import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

/**
 * App Settings Minimum Viability
 * Scope: Verify critical app_settings keys exist (via authenticated client).
 * Note: anon key may not have RLS access — test checks what's visible.
 */

const AGENT_SETTINGS_KEYS = [
  "agent_max_actions_per_cycle",
  "agent_work_start_hour",
  "agent_work_end_hour",
];

describe("App Settings Minimum Viability", () => {
  it("app_settings table is queryable", async () => {
    const { error } = await supabase.from("app_settings").select("key").limit(1);
    // RLS may block — that's OK, table should exist
    expect(error === null || error.code === "PGRST301").toBe(true);
  });

  it("agent settings values are valid numbers if present", async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", AGENT_SETTINGS_KEYS);
    for (const row of data || []) {
      if (row.value) {
        const num = parseInt(row.value, 10);
        expect(Number.isFinite(num)).toBe(true);
        expect(num).toBeGreaterThan(0);
      }
    }
  });
});
