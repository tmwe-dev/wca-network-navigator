/**
 * Zod Schema: Business Cards
 */
import { z } from "zod";

export const BusinessCardRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  company_name: z.string().nullable(),
  contact_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  position: z.string().nullable(),
  location: z.string().nullable(),
  event_name: z.string().nullable(),
  met_at: z.string().nullable(),
  photo_url: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  lead_status: z.string(),
  match_status: z.string(),
  match_confidence: z.number().nullable(),
  matched_partner_id: z.string().uuid().nullable(),
  matched_contact_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export type BusinessCardRow = z.infer<typeof BusinessCardRowSchema>;
