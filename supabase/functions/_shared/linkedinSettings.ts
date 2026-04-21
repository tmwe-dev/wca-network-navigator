/**
 * linkedinSettings — Load LinkedIn operation limits from app_settings table
 * with fallback defaults. This allows administrators to adjust limits via the UI
 * without requiring code changes.
 */

export interface LinkedInSettings {
  dailyLimit: number;
  hourlyLimit: number;
  sendStartHour: number;
  sendEndHour: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  bulkMax: number;
}

// Default values matching the original hardcoded limits
const DEFAULTS: LinkedInSettings = {
  dailyLimit: 50,
  hourlyLimit: 3,
  sendStartHour: 9,
  sendEndHour: 19,
  minDelaySeconds: 45,
  maxDelaySeconds: 180,
  bulkMax: 50,
};

/**
 * Load LinkedIn settings from app_settings table.
 * Returns settings with fallback to hardcoded defaults if not found.
 *
 * @param supabase Supabase client instance
 * @returns LinkedInSettings object with all configured limits
 */
export async function loadLinkedInSettings(supabase: any): Promise<LinkedInSettings> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "linkedin_daily_limit",
        "linkedin_hourly_limit",
        "linkedin_send_start_hour",
        "linkedin_send_end_hour",
        "linkedin_min_delay_seconds",
        "linkedin_max_delay_seconds",
        "linkedin_bulk_max",
      ]);

    if (error) {
      console.error("[linkedinSettings] Query error:", error);
      return DEFAULTS;
    }

    const settings: LinkedInSettings = { ...DEFAULTS };

    // Build a map from the returned settings
    const settingsMap: Record<string, string> = {};
    data?.forEach((row: { key: string; value: string }) => {
      settingsMap[row.key] = row.value;
    });

    // Parse and assign settings, validating values
    if (settingsMap.linkedin_daily_limit) {
      const val = parseInt(settingsMap.linkedin_daily_limit, 10);
      if (!isNaN(val) && val > 0) settings.dailyLimit = val;
    }

    if (settingsMap.linkedin_hourly_limit) {
      const val = parseInt(settingsMap.linkedin_hourly_limit, 10);
      if (!isNaN(val) && val > 0) settings.hourlyLimit = val;
    }

    if (settingsMap.linkedin_send_start_hour) {
      const val = parseInt(settingsMap.linkedin_send_start_hour, 10);
      if (!isNaN(val) && val >= 0 && val < 24) settings.sendStartHour = val;
    }

    if (settingsMap.linkedin_send_end_hour) {
      const val = parseInt(settingsMap.linkedin_send_end_hour, 10);
      if (!isNaN(val) && val >= 0 && val < 24) settings.sendEndHour = val;
    }

    if (settingsMap.linkedin_min_delay_seconds) {
      const val = parseInt(settingsMap.linkedin_min_delay_seconds, 10);
      if (!isNaN(val) && val > 0) settings.minDelaySeconds = val;
    }

    if (settingsMap.linkedin_max_delay_seconds) {
      const val = parseInt(settingsMap.linkedin_max_delay_seconds, 10);
      if (!isNaN(val) && val > 0) settings.maxDelaySeconds = val;
    }

    if (settingsMap.linkedin_bulk_max) {
      const val = parseInt(settingsMap.linkedin_bulk_max, 10);
      if (!isNaN(val) && val > 0) settings.bulkMax = val;
    }

    return settings;
  } catch (err) {
    console.error("[linkedinSettings] Unexpected error:", err);
    return DEFAULTS;
  }
}

/**
 * Get default LinkedIn settings (for UI initialization and testing)
 */
export function getLinkedInDefaults(): LinkedInSettings {
  return { ...DEFAULTS };
}
