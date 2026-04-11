/**
 * Zod Schema: Operators
 */
import { z } from "zod";

export const OperatorRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  name: z.string(),
  email: z.string(),
  is_admin: z.boolean(),
  is_active: z.boolean(),
  avatar_url: z.string().nullable(),
  reply_to_email: z.string().nullable(),
  linkedin_profile_url: z.string().nullable(),
  whatsapp_phone: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OperatorRow = z.infer<typeof OperatorRowSchema>;
