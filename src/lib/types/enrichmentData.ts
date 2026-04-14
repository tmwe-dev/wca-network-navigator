/**
 * Typed interfaces for enrichment_data JSON fields.
 * Replaces `as any` casts on enrichment_data across the codebase. // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
 */

export interface ContactProfile {
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  position?: string;
  linkedin_url?: string;
  source?: string;
}

export interface EnrichmentData {
  website?: string;
  phone?: string;
  email?: string;
  description?: string;
  linkedin_url?: string;
  linkedin_connected?: boolean;
  connectionStatus?: string;
  contact_profiles?: Record<string, ContactProfile>;
  deep_search?: Record<string, unknown>;
  scraped_at?: string;
  [key: string]: unknown;
}

export function asEnrichmentData(data: unknown): EnrichmentData {
  if (!data || typeof data !== "object") return {};
  return data as EnrichmentData;
}
