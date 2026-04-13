export type SortField = "name" | "city" | "rating" | "years";
export type SortDir = "asc" | "desc";
export type SortEntry = { field: SortField; dir: SortDir };

export interface PartnerRowData {
  id: string;
  company_name: string;
  country_code: string;
  city: string;
  rating: number | null;
  member_since: string | null;
  logo_url: string | null;
  is_favorite: boolean | null;
  partner_type: string | null;
  partner_services?: { service_category: string }[];
  partner_networks?: { id: string; network_name: string; expires?: string }[];
  partner_contacts?: { id: string; name: string; contact_alias?: string; is_primary?: boolean; email?: string; direct_phone?: string; mobile?: string }[];
  branch_cities?: unknown[];
  enrichment_data?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface CountryWorkbenchProps {
  countryCode: string;
  partners: PartnerRowData[];
  onBack: () => void;
  onSelectPartner: (id: string) => void;
  selectedId: string | null;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAllFiltered: (ids: string[]) => void;
}

export const DEFAULT_DIRS: Record<SortField, SortDir> = {
  name: "asc",
  city: "asc",
  rating: "desc",
  years: "desc",
};
