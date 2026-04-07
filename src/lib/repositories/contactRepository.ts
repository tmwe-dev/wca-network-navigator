import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ImportedContact = Tables<"imported_contacts">;
export type ImportedContactInsert = TablesInsert<"imported_contacts">;
export type ImportedContactUpdate = TablesUpdate<"imported_contacts">;

export interface ContactFilters {
  country?: string;
  origin?: string;
  quality?: string;
  leadStatus?: string;
  importLogId?: string;
  isSelected?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

/**
 * Centralized data access for the `imported_contacts` table.
 */
export const contactRepository = {
  /**
   * Fetch contacts with optional filtering and pagination.
   * Returns `{ data, count }` where count is the total matching rows.
   */
  async findAll(
    filters: ContactFilters = {},
    pagination: PaginationOptions = {},
  ) {
    const { page = 0, pageSize = 50 } = pagination;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("imported_contacts")
      .select("*", { count: "exact" });

    if (filters.country) query = query.eq("country", filters.country);
    if (filters.origin) query = query.eq("origin", filters.origin);
    if (filters.leadStatus) query = query.eq("lead_status", filters.leadStatus);
    if (filters.importLogId) query = query.eq("import_log_id", filters.importLogId);
    if (filters.isSelected !== undefined) query = query.eq("is_selected", filters.isSelected);
    if (filters.search) {
      query = query.or(
        `company_name.ilike.%${filters.search}%,name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
      );
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data ?? [], count: count ?? 0 };
  },

  /** Fetch a single contact by ID. Returns null if not found. */
  async findById(id: string) {
    const { data, error } = await supabase
      .from("imported_contacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Create a new imported contact. */
  async create(contact: ImportedContactInsert) {
    const { data, error } = await supabase
      .from("imported_contacts")
      .insert(contact)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Update an existing contact by ID. */
  async update(id: string, updates: ImportedContactUpdate) {
    const { data, error } = await supabase
      .from("imported_contacts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Delete multiple contacts by ID. */
  async deleteMany(ids: string[]) {
    const { error } = await supabase
      .from("imported_contacts")
      .delete()
      .in("id", ids);
    if (error) throw error;
  },
};
