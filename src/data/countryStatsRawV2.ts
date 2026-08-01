/**
 * DAL — country_code grezzi da partners (aggregazione lato client).
 */
import { supabase } from "@/integrations/supabase/client";

export async function findPartnerCountryCodes(): Promise<string[]> {
  const { data, error } = await supabase
    .from("partners")
    .select("country_code")
    .not("country_code", "is", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.country_code).filter((c): c is string => c != null);
}
