/**
 * DAL — query di export (contatti, partner, deal).
 * Tutte le colonne selezionate sono verificate sullo schema live.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ExportFilters {
  dateRange?: {
    from: string;
    to: string;
  };
  status?: string | string[];
  tags?: string | string[];
  search?: string;
}

export async function fetchContactsExportRows(filters?: ExportFilters): Promise<Record<string, unknown>[]> {
  // Colonne verificate sullo schema live (`position`, non `title`).
  let query = supabase.from("imported_contacts")
    .select(
      "id, name, email, phone, mobile, company_name, position, country, lead_status, created_at, interaction_count"
    );

  if (filters?.dateRange) {
    query = query
      .gte("created_at", filters.dateRange.from)
      .lte("created_at", filters.dateRange.to);
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("lead_status", statuses);
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},company_name.ilike.${term}`);
  }

  const { data, error } = await query.limit(50000);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPartnersExportRows(filters?: ExportFilters): Promise<Record<string, unknown>[]> {
  // Colonne verificate sullo schema live: company_name / country_name / lead_status.
  let query = supabase.from("partners")
    .select(
      "id, company_name, country_name, website, email, phone, partner_type, lead_status, created_at"
    );

  if (filters?.dateRange) {
    query = query
      .gte("created_at", filters.dateRange.from)
      .lte("created_at", filters.dateRange.to);
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("lead_status", statuses);
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    query = query.or(`company_name.ilike.${term},email.ilike.${term},website.ilike.${term}`);
  }

  const { data, error } = await query.limit(50000);
  if (error) throw error;
  return data ?? [];
}

export async function fetchDealsExportRows(filters?: ExportFilters): Promise<Record<string, unknown>[]> {
  let query = supabase.from("deals")
    .select(
      "id, title, partner_id, contact_id, stage, amount, probability, expected_close_date, actual_close_date, created_at, updated_at"
    );

  if (filters?.dateRange) {
    query = query
      .gte("created_at", filters.dateRange.from)
      .lte("created_at", filters.dateRange.to);
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in("stage", statuses);
  }

  const { data, error } = await query.limit(50000);
  if (error) throw error;
  return data ?? [];
}

