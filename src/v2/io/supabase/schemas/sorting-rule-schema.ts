/**
 * Zod Schema: Sorting Rules
 */
import { z } from "zod";

export const SortingRuleRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  field: z.string(),
  direction: z.string(),
  priority: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export type SortingRuleRow = z.infer<typeof SortingRuleRowSchema>;
