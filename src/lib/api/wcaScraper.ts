import { supabase } from "@/integrations/supabase/client";

export interface ScrapeSingleResult {
  success: boolean;
  found?: boolean;
  wcaId: number;
  action?: "inserted" | "updated" | "skipped";
  partnerId?: string;
  partner?: {
    company_name: string;
    city: string;
    country_code: string;
    country_name: string;
    email?: string;
    phone?: string;
    website?: string;
    wca_id?: number;
    address?: string;
  };
  error?: string;
}

export async function scrapeWcaPartnerById(wcaId: number): Promise<ScrapeSingleResult> {
  const { data, error } = await supabase.functions.invoke("scrape-wca-partners", {
    body: { wcaId },
  });

  if (error) {
    return { success: false, wcaId, error: error.message };
  }

  return data as ScrapeSingleResult;
}
