import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

/**
 * App Settings Minimum Viability
 * Scope: Verify that critical app_settings keys exist in the database.
 * Preconditions: app_settings table populated.
 * Tables: app_settings.
 */

const REQUIRED_SMTP_KEYS = ["smtp_host", "smtp_user", "smtp_password"];
const AGENT_SETTINGS_KEYS = [
  "agent_max_actions_per_cycle",
  "agent_work_start_hour",
  "agent_work_end_hour",
];

describe("App Settings Minimum Viability", () => {
  it("SMTP settings exist and have values", async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", REQUIRED_SMTP_KEYS);
    if (error) throw error;

    const foundKeys = new Set(data?.map(r => r.key));
    for (const key of REQUIRED_SMTP_KEYS) {
      expect(foundKeys.has(key)).toBe(true);
    }
    for (const row of data || []) {
      expect(row.value).toBeTruthy();
    }
  });

  it("agent settings keys exist (with defaults acceptable)", async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", AGENT_SETTINGS_KEYS);
    if (error) throw error;
    // These are optional with code defaults, but if present must have valid numeric values
    for (const row of data || []) {
      if (row.value) {
        const num = parseInt(row.value, 10);
        expect(Number.isFinite(num)).toBe(true);
        expect(num).toBeGreaterThan(0);
      }
    }
  });
});
