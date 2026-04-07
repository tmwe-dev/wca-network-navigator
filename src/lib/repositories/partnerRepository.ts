import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Partner = Tables<"partners">;
export type PartnerInsert = TablesInsert<"partners">;
export type PartnerUpdate = TablesUpdate<"partners">;

/**
 * Centralized data access for the `partners` table.
 * Replaces scattered `supabase.from("partners")` calls across hooks.
 */
export const partnerRepository = {
  /** Fetch all partners for the current user. */
  async findAll() {
    const { data, error } = await supabase
      .from("partners")
      .select("*");
    if (error) throw error;
    return data;
  },

  /** Fetch partners filtered by country code(s). */
  async findByCountry(countryCodes: string | string[]) {
    const codes = Array.isArray(countryCodes) ? countryCodes : [countryCodes];
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .in("country_code", codes);
    if (error) throw error;
    return data;
  },

  /** Fetch a single partner by WCA ID. Returns null if not found. */
  async findByWcaId(wcaId: number) {
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .eq("wca_id", wcaId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Upsert a partner (insert or update). Returns the saved row. */
  async upsert(partner: PartnerInsert) {
    const { data, error } = await supabase
      .from("partners")
      .upsert(partner)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
