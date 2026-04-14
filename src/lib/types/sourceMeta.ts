/**
 * Typed interface for source_meta JSON fields on activities, contacts, etc.
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
 * Replaces `as any` casts on source_meta across the codebase.
 */

export interface SourceMeta {
  company_name?: string;
  partner_name?: string;
  contact_name?: string;
  country_code?: string;
  email?: string;
  phone?: string;
  activity_type?: string;
  notes?: string;
  [key: string]: unknown;
}

export function asSourceMeta(data: unknown): SourceMeta {
  if (!data || typeof data !== "object") return {};
  return data as SourceMeta;
}
