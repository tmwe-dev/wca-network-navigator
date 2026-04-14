/**
 * useImportLogs — Query hooks (read-only)
 * Split from the original 619-LOC monolith.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImportLog {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string | null;
  file_size: number;
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  status: string;
  normalization_method: string;
  processing_batch: number;
  total_batches: number;
  group_name?: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ImportedContact {
  id: string;
  import_log_id: string;
  row_number: number;
  company_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  zip_code: string | null;
  note: string | null;
  origin: string | null;
  company_alias: string | null;
  contact_alias: string | null;
  position: string | null;
  external_id: string | null;
  lead_status: string;
  deep_search_at: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  converted_at: string | null;
  is_selected: boolean;
  is_transferred: boolean;
  raw_data: unknown;
  created_at: string;
}

export interface ImportError {
  id: string;
  import_log_id: string;
  row_number: number;
  error_type: string;
  error_message: string | null;
  raw_data: unknown;
  corrected_data: unknown;
  status: string;
  attempted_corrections: number;
  ai_suggestions: unknown;
  created_at: string;
}

export function useImportLogs() {
  return useQuery({
    queryKey: ["import-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ImportLog[];
    },
  });
}

export function useImportLog(id: string | null) {
  return useQuery({
    queryKey: ["import-log", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("import_logs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ImportLog;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const log = query.state.data as ImportLog | null;
      return log?.status === "processing" ? 2000 : false;
    },
  });
}

export function useImportedContacts(importLogId: string | null) {
  return useQuery({
    queryKey: ["imported-contacts", importLogId],
    queryFn: async () => {
      if (!importLogId) return [];
      const PAGE_SIZE = 1000;
      let allData: unknown[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("imported_contacts")
          .select("*")
          .eq("import_log_id", importLogId)
          .order("row_number", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allData as ImportedContact[];
    },
    enabled: !!importLogId,
  });
}

export function useImportErrors(importLogId: string | null) {
  return useQuery({
    queryKey: ["import-errors", importLogId],
    queryFn: async () => {
      if (!importLogId) return [];
      const { data, error } = await supabase
        .from("import_errors")
        .select("*")
        .eq("import_log_id", importLogId)
        .order("row_number", { ascending: true });
      if (error) throw error;
      return data as ImportError[];
    },
    enabled: !!importLogId,
  });
}
