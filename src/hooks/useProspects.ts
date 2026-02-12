import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Prospect {
  id: string;
  company_name: string;
  partita_iva: string | null;
  codice_fiscale: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  address: string | null;
  cap: string | null;
  phone: string | null;
  email: string | null;
  pec: string | null;
  website: string | null;
  fatturato: number | null;
  utile: number | null;
  dipendenti: number | null;
  anno_bilancio: number | null;
  codice_ateco: string | null;
  descrizione_ateco: string | null;
  forma_giuridica: string | null;
  data_costituzione: string | null;
  rating_affidabilita: string | null;
  credit_score: number | null;
  source: string;
  enrichment_data: any;
  created_at: string;
  updated_at: string;
}

export function useProspects() {
  return useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects" as any)
        .select("*")
        .order("company_name");
      if (error) throw error;
      return (data || []) as unknown as Prospect[];
    },
  });
}
