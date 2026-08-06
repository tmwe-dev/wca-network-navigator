/**
 * DAL — email_drafts
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toRecords } from "@/lib/records";

type DraftInsert = Database["public"]["Tables"]["email_drafts"]["Insert"];
type DraftUpdate = Database["public"]["Tables"]["email_drafts"]["Update"];

type DraftDbRow = Database["public"]["Tables"]["email_drafts"]["Row"];

/** Contratto UI della bozza: colonne Json normalizzate e validate a runtime. */
export interface EmailDraftRow {
  id: string;
  subject: string | null;
  html_body: string | null;
  category: string | null;
  recipient_type: string;
  recipient_filter: unknown;
  attachment_ids: string[];
  link_urls: { label: string; url: string }[];
  status: string;
  sent_count: number;
  total_count: number;
  created_at: string;
  sent_at: string | null;
}

/** Solo stringhe: gli elementi non stringa vengono scartati. */
function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Solo voci con `label` e `url` stringa. */
function parseLinkUrls(value: unknown): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const r of toRecords(value)) {
    if (typeof r.label === "string" && typeof r.url === "string") out.push({ label: r.label, url: r.url });
  }
  return out;
}

function mapEmailDraftRow(r: DraftDbRow): EmailDraftRow {
  return {
    id: r.id,
    subject: r.subject,
    html_body: r.html_body,
    category: r.category,
    recipient_type: r.recipient_type ?? "",
    recipient_filter: r.recipient_filter,
    attachment_ids: parseStringArray(r.attachment_ids),
    link_urls: parseLinkUrls(r.link_urls),
    status: r.status,
    sent_count: r.sent_count,
    total_count: r.total_count,
    created_at: r.created_at,
    sent_at: r.sent_at,
  };
}

export async function findEmailDrafts(): Promise<EmailDraftRow[]> {
  const { data, error } = await supabase.from("email_drafts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapEmailDraftRow);
}

export async function updateEmailDraft(id: string, patch: DraftUpdate): Promise<void> {
  const { error } = await supabase.from("email_drafts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function insertEmailDraftReturningRow(draft: DraftInsert) {
  const { data, error } = await supabase.from("email_drafts").insert(draft).select().single();
  if (error) throw error;
  return data;
}

export async function countEmailDrafts() {
  const { count, error } = await supabase.from("email_drafts").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function insertEmailDraft(draft: DraftInsert) {
  const { error } = await supabase.from("email_drafts").insert(draft);
  if (error) throw error;
}

export async function insertEmailDraftReturning(draft: DraftInsert) {
  const { data, error } = await supabase.from("email_drafts").insert(draft);
  if (error) throw error;
  return data;
}
