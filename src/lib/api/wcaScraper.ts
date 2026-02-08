import { supabase } from "@/integrations/supabase/client";

export interface ScrapeResult {
  country: string;
  found: number;
  inserted: number;
  updated: number;
  errors: number;
}

export interface ScrapeResponse {
  success: boolean;
  error?: string;
  summary?: {
    totalCountries: number;
    totalFound: number;
    totalInserted: number;
    totalUpdated: number;
    totalErrors: number;
  };
  results?: ScrapeResult[];
}

export async function scrapeWcaPartners(
  countryCodes: string[],
  countryNames: string[]
): Promise<ScrapeResponse> {
  const { data, error } = await supabase.functions.invoke("scrape-wca-partners", {
    body: { countryCodes, countryNames },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as ScrapeResponse;
}
