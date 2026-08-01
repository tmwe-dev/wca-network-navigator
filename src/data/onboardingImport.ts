/**
 * DAL — imported_contacts (onboarding CSV import).
 */
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateManualImportLog } from "@/data/manualContacts";
import type { Database } from "@/integrations/supabase/types";

type ImportedContactInsert = Database["public"]["Tables"]["imported_contacts"]["Insert"];

export interface OnboardingContactInput {
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  country: string | null;
}

/** Importa contatti CSV in batch da 50, usando l'import log manuale dell'utente. */
export async function insertOnboardingContacts(userId: string, contacts: OnboardingContactInput[]): Promise<void> {
  const importLogId = await getOrCreateManualImportLog(userId);
  const rows: ImportedContactInsert[] = contacts.map((c) => ({
    import_log_id: importLogId,
    user_id: userId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company_name: c.company_name,
    country: c.country,
    origin: "csv_onboarding",
    lead_status: "new",
  }));
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("imported_contacts").insert(batch);
    if (error) throw error;
  }
}
