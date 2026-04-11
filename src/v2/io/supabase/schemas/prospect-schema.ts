/**
 * Zod Schema: Prospects (RA)
 */
import { z } from "zod";

export const ProspectRowSchema = z.object({
  id: z.string().uuid(),
  company_name: z.string(),
  ateco_code: z.string().nullable(),
  region: z.string().nullable(),
  province: z.string().nullable(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  revenue: z.number().nullable(),
  employees: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
});

export type ProspectRow = z.infer<typeof ProspectRowSchema>;
