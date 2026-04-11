/**
 * Zod Schema: KB Entries
 */
import { z } from "zod";

export const KbEntryRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  category: z.string().nullable(),
  chapter: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  priority: z.number(),
  is_active: z.boolean(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type KbEntryRow = z.infer<typeof KbEntryRowSchema>;
