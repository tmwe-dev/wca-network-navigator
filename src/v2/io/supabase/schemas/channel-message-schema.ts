/**
 * Zod Schema: Channel Messages
 */
import { z } from "zod";

export const ChannelMessageRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  channel: z.string(),
  direction: z.string(),
  subject: z.string().nullable(),
  from_address: z.string().nullable(),
  to_address: z.string().nullable(),
  body_text: z.string().nullable(),
  body_html: z.string().nullable(),
  partner_id: z.string().uuid().nullable(),
  category: z.string().nullable(),
  read_at: z.string().nullable(),
  email_date: z.string().nullable(),
  created_at: z.string(),
});

export type ChannelMessageRow = z.infer<typeof ChannelMessageRowSchema>;
