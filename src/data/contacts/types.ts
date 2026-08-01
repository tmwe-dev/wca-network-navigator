import type { Database } from "@/integrations/supabase/types";

export type LeadStatus =
  | "new"
  | "first_touch_sent"
  | "holding"
  | "engaged"
  | "qualified"
  | "negotiation"
  | "converted"
  | "archived"
  | "blacklisted";

export type ImportedContactRow = Database["public"]["Tables"]["imported_contacts"]["Row"];
export type ImportedContactInsert = Database["public"]["Tables"]["imported_contacts"]["Insert"];

export interface ContactFilters {
  search?: string;
  country?: string;
  countries?: string[];
  origin?: string;
  origins?: string[];
  leadStatus?: LeadStatus;
  dateFrom?: string;
  dateTo?: string;
  hasDeepSearch?: boolean;
  hasAlias?: boolean;
  holdingPattern?: "out" | "in" | "all";
  groupBy?: "country" | "origin" | "status" | "date";
  importLogId?: string;
  metPersonally?: boolean;
  channel?: string;
  quality?: string;
  wcaMatch?: "matched" | "unmatched" | "all";
  page?: number;
  pageSize?: number;
}

export interface ContactInteraction {
  id: string;
  contact_id: string;
  interaction_type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  created_at: string;
  created_by: string | null;
}

export type ContactPaginatedSort =
  | "company_asc"
  | "company_desc"
  | "name_asc"
  | "name_desc"
  | "city_asc"
  | "city_desc"
  | "country_asc"
  | "country_desc"
  | "origin_asc"
  | "origin_desc"
  | "recent";

export interface ContactPaginatedFilters {
  search?: string;
  countries?: string[];
  origins?: string[];
  cities?: string[];
  companies?: string[];
  names?: string[];
  leadStatus?: string;
  channel?: string;
  quality?: string;
  wcaMatch?: "matched" | "unmatched" | "all";
  holdingPattern?: "out" | "in" | "all";
  importLogId?: string;
  sort?: ContactPaginatedSort | string;
}
