/**
 * Convenience type aliases for Supabase table rows.
 * Use these instead of `any` for typed partner/contact/service data.
 */
import type { Tables } from "@/integrations/supabase/types";

export type PartnerRow = Tables<"partners">;
export type PartnerContactRow = Tables<"partner_contacts">;
export type PartnerServiceRow = Tables<"partner_services">;
export type PartnerNetworkRow = Tables<"partner_networks">;
export type PartnerCertificationRow = Tables<"partner_certifications">;
export type ActivityRow = Tables<"activities">;
export type ImportedContactRow = Tables<"imported_contacts">;
export type DownloadJobRow = Tables<"download_jobs">;
export type DirectoryCacheRow = Tables<"directory_cache">;

/** Partner with joined relations (from select with nested selects) */
export interface PartnerWithRelations extends PartnerRow {
  partner_contacts?: PartnerContactRow[];
  partner_services?: PartnerServiceRow[];
  partner_networks?: PartnerNetworkRow[];
  partner_certifications?: PartnerCertificationRow[];
  partner_social_links?: Tables<"partner_social_links">[];
  reminders?: Tables<"reminders">[];
}
