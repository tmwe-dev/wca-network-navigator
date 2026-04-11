/**
 * Zod Schema: Credit Transactions
 */
import { z } from "zod";

export const CreditTransactionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  amount: z.number(),
  operation: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
});

export type CreditTransactionRow = z.infer<typeof CreditTransactionRowSchema>;
