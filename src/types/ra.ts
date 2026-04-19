// ── Report Aziende (RA) Module Types ──

export interface RAProspect {
  id: string;
  user_id: string | null;
  company_name: string;
  partita_iva: string | null;
  codice_fiscale: string | null;
  address: string | null;
  cap: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
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
  source_url: string | null;
  raw_profile_html: string | null;
  lead_status: RALeadStatus;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export type RALeadStatus =
  | "new"
  | "first_touch_sent"
  | "holding"
  | "engaged"
  | "qualified"
  | "negotiation"
  | "converted"
  | "archived"
  | "blacklisted";

export interface RAContact {
  id: string;
  prospect_id: string;
  name: string;
  role: string | null;
  codice_fiscale: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface RAScrapingJob {
  id: string;
  user_id: string | null;
  job_type: "search" | "scrape_batch" | "scrape_single";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  ateco_codes: string[] | null;
  regions: string[] | null;
  provinces: string[] | null;
  min_fatturato: number | null;
  max_fatturato: number | null;
  total_items: number;
  processed_items: number;
  saved_items: number;
  error_count: number;
  delay_seconds: number;
  batch_size: number;
  started_at: string | null;
  completed_at: string | null;
  error_log: string | null;
  created_at: string;
}

export interface RAInteraction {
  id: string;
  prospect_id: string;
  interaction_type: "call" | "email" | "meeting" | "note" | "pec";
  title: string;
  description: string | null;
  outcome: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Filters ──

export interface RAProspectFilters {
  search?: string;
  atecoCodes?: string[];
  regions?: string[];
  provinces?: string[];
  leadStatus?: RALeadStatus;
  hasEmail?: boolean;
  hasPec?: boolean;
  hasPhone?: boolean;
  minFatturato?: number;
  maxFatturato?: number;
  minDipendenti?: number;
  maxDipendenti?: number;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

export interface RADashboardStats {
  totalProspects: number;
  withEmail: number;
  withPec: number;
  withPhone: number;
  topAteco: Array<{ code: string; description: string; count: number }>;
  recentProspects: RAProspect[];
  activeJobs: RAScrapingJob[];
}
