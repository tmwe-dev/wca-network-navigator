/**
 * Zod Schema: Partners — matches actual DB columns
 */
import { z } from "zod";

export const PartnerRowSchema = z.object({
  id: z.string().uuid(),
  company_name: z.string(),
  wca_id: z.number().nullable(),
  country_code: z.string(),
  country_name: z.string(),
  city: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  fax: z.string().nullable(),
  emergency_phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  member_since: z.string().nullable(),
  membership_expires: z.string().nullable(),
  profile_description: z.string().nullable(),
  office_type: z.string().nullable(),
  partner_type: z.string().nullable(),
  has_branches: z.boolean().nullable(),
  branch_cities: z.unknown().nullable(),
  is_active: z.boolean().nullable(),
  is_favorite: z.boolean().nullable(),
  lead_status: z.string(),
  logo_url: z.string().nullable(),
  rating: z.number().nullable(),
  rating_details: z.unknown().nullable(),
  enrichment_data: z.record(z.string(), z.unknown()).nullable(),
  enriched_at: z.string().nullable(),
  raw_profile_html: z.string().nullable(),
  raw_profile_markdown: z.string().nullable(),
  ai_parsed_at: z.string().nullable(),
  company_alias: z.string().nullable(),
  interaction_count: z.number(),
  last_interaction_at: z.string().nullable(),
  converted_at: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
});

export type PartnerRow = z.infer<typeof PartnerRowSchema>;
