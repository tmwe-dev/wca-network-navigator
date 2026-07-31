/**
 * DAL — inserimento manuale contatti (AddContactDialog).
 * Estratto 1:1 dal componente: stesse tabelle, stessi payload e stessa
 * semantica errori (log manuale: read tollerante; insert: errori propagati).
 */
import { supabase } from "@/integrations/supabase/client";

const MANUAL_FILE_NAME = "__manual_entry__";

/** Ritorna l'import log "manuale" dell'utente, creandolo se assente. */
export async function getOrCreateManualImportLog(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("import_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("file_name", MANUAL_FILE_NAME)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: newLog, error } = await supabase
    .from("import_logs")
    .insert({
      user_id: userId,
      file_name: MANUAL_FILE_NAME,
      file_size: 0,
      total_rows: 0,
      imported_rows: 0,
      status: "completed",
      normalization_method: "manual",
    })
    .select("id")
    .single();
  if (error) throw error;
  return newLog.id;
}

export interface ManualContactInput {
  importLogId: string;
  userId: string;
  companyName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  position: string | null;
  note: string | null;
}

/** Crea un contatto importato manualmente e ritorna il suo id. */
export async function insertManualContact(input: ManualContactInput): Promise<string> {
  const { data, error } = await supabase
    .from("imported_contacts")
    .insert({
      import_log_id: input.importLogId,
      user_id: input.userId,
      company_name: input.companyName,
      name: input.name,
      email: input.email,
      phone: input.phone,
      mobile: input.mobile,
      country: input.country,
      city: input.city,
      position: input.position,
      note: input.note,
      origin: "Manuale",
      lead_status: "new",
      row_number: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export interface ManualPartnerContactInput {
  partnerId: string;
  userId: string;
  name: string;
  title: string | null;
  email: string | null;
  directPhone: string | null;
  mobile: string | null;
}

/** Crea un contatto partner inserito manualmente e ritorna il suo id. */
export async function insertManualPartnerContact(input: ManualPartnerContactInput): Promise<string> {
  const { data, error } = await supabase
    .from("partner_contacts")
    .insert({
      partner_id: input.partnerId,
      user_id: input.userId,
      name: input.name,
      title: input.title,
      email: input.email,
      direct_phone: input.directPhone,
      mobile: input.mobile,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export interface OnboardingContactInput {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  country_code: string | null;
  source: string;
  lead_status: "new";
}

/** Import massivo di contatti CSV in onboarding, a batch. */
export async function insertOnboardingContactsBatch(contacts: OnboardingContactInput[], batchSize = 50): Promise<void> {
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const { error } = await supabase.from("imported_contacts").insert(batch as never);
    if (error) throw error;
  }
}
