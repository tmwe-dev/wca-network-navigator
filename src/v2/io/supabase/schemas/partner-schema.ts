/**
 * Zod Schema: Partners — Vol. II §5.3
 * Validates DB rows from `partners` table.
 */
import { z } from "zod";

export const PartnerRowSchema = z.object({
  id: z.string().uuid(),
  company_name: z.string(),
  wca_id: z.number().nullable(),
  country_code: z.string(),
  country_name: z.string(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  network_name: z.string(),
  member_since: z.string().nullable(),
  is_blacklisted: z.boolean(),
  enrichment_data: z.record(z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string().uuid().nullable(),
});

export type PartnerRow = z.infer<typeof PartnerRowSchema>;

export const PartnerListResponseSchema = z.array(PartnerRowSchema);
