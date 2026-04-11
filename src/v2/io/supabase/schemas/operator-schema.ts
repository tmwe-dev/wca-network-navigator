/**
 * Zod Schema: Operators
 */
import { z } from "zod";

export const OperatorRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  is_admin: z.boolean(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export type OperatorRow = z.infer<typeof OperatorRowSchema>;
