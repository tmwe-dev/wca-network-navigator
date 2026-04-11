/**
 * Zod Schema: Prospects (RA)
 */
import { z } from "zod";

export const ProspectRowSchema = z.object({
  id: z.string().uuid(),
  company_name: z.string(),
  codice_ateco: z.string().nullable(),
  descrizione_ateco: z.string().nullable(),
  region: z.string().nullable(),
  province: z.string().nullable(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  cap: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  pec: z.string().nullable(),
  website: z.string().nullable(),
  fatturato: z.number().nullable(),
  dipendenti: z.number().nullable(),
  utile: z.number().nullable(),
  lead_status: z.string(),
  source: z.string(),
  interaction_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProspectRow = z.infer<typeof ProspectRowSchema>;
