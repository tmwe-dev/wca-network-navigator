/**
 * DAL — profiles
 */
import { supabase } from "@/integrations/supabase/client";

export async function checkProfileConnection() {
  const { error } = await supabase.from("profiles").select("id").limit(1);
  return { error };
}

export async function getProfileSummary() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, onboarding_completed")
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfileOnboarding(userId: string) {
  const { error } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("user_id", userId);
  if (error) throw error;
}

/** Stato onboarding di uno specifico utente (per il gate di AuthenticatedLayout). */
export async function getOnboardingCompletedForUser(userId: string): Promise<boolean | null> {
  const { data } = await supabase.from("profiles").select("onboarding_completed").eq("user_id", userId).maybeSingle();
  return data?.onboarding_completed ?? null;
}

export interface OnboardingProfileRow {
  display_name: string | null;
  language: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  linkedin_url: string | null;
}

/** Profilo esistente per pre-compilare il wizard di onboarding. */
export async function findProfileForOnboarding(userId: string): Promise<OnboardingProfileRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, language, phone, whatsapp_number, linkedin_url")
    .eq("user_id", userId)
    .maybeSingle();
  return (data ?? null) as OnboardingProfileRow | null;
}

export interface OnboardingProfilePayload {
  user_id: string;
  display_name: string;
  language: string;
  phone: string | null;
  whatsapp_number: string | null;
  linkedin_url: string | null;
  onboarding_completed: boolean;
}

/** Upsert del profilo al termine dell'onboarding. Ritorna l'id salvato o null. */
export async function upsertOnboardingProfile(payload: OnboardingProfilePayload): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
