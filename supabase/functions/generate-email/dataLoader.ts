/**
 * dataLoader.ts — Load partner/contact metadata (networks, services, settings, social links)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";
import type { NetworkRow, ServiceRow, SocialLinkRow } from "./promptBuilder.ts";
import type { PartnerData } from "./promptBuilder.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export interface LoadedMetadata {
  networks: NetworkRow[];
  services: ServiceRow[];
  socialLinks: SocialLinkRow[];
  settings: Record<string, string>;
}

/**
 * Load networks, services, social links, and app settings in parallel.
 */
export async function loadPartnerMetadata(
  supabase: SupabaseClient,
  userId: string,
  partner: PartnerData,
  quality: Quality,
  isPartnerSource: boolean,
): Promise<LoadedMetadata> {
  const [networksRes, servicesRes, settingsRes, socialRes] = await Promise.all([
    isPartnerSource
      ? supabase.from("partner_networks").select("network_name").eq("partner_id", partner.id!)
      : Promise.resolve({ data: [] }),
    isPartnerSource && quality !== "fast"
      ? supabase.from("partner_services").select("service_category").eq("partner_id", partner.id!)
      : Promise.resolve({ data: [] }),
    supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "ai_%"),
    isPartnerSource && quality === "premium"
      ? supabase
          .from("partner_social_links")
          .select("platform, url, contact_id")
          .eq("partner_id", partner.id!)
      : Promise.resolve({ data: [] }),
  ]);

  const networks = (networksRes.data || []) as NetworkRow[];
  const services = (servicesRes.data || []) as ServiceRow[];
  const socialLinks = (socialRes.data || []) as SocialLinkRow[];
  const settings: Record<string, string> = {};
  ((settingsRes.data || []) as { key: string; value: string | null }[]).forEach((r) => {
    settings[r.key] = r.value || "";
  });

  return { networks, services, socialLinks, settings };
}
