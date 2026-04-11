/**
 * Zod Schema: Contacts — imported_contacts table
 */
import { z } from "zod";

export const ContactRowSchema = z.object({
  id: z.string().uuid(),
  import_log_id: z.string().uuid(),
  name: z.string().nullable(),
  company_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  position: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  origin: z.string().nullable(),
  lead_status: z.string(),
  is_selected: z.boolean(),
  is_transferred: z.boolean(),
  wca_partner_id: z.string().uuid().nullable(),
  wca_match_confidence: z.number().nullable(),
  row_number: z.number(),
  interaction_count: z.number(),
  last_interaction_at: z.string().nullable(),
  created_at: z.string(),
  user_id: z.string().uuid().nullable(),
});

export type ContactRow = z.infer<typeof ContactRowSchema>;

export const ContactListResponseSchema = z.array(ContactRowSchema);
