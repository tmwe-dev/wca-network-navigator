/**
 * DAL — Funnemail Inbox.
 *
 * Espone letture per il client di posta:
 *  - cartelle attive (operative + archive + sorting)
 *  - conteggi per cartella (ultimi 30gg)
 *  - lista mail in una cartella (join channel_messages + decision)
 *  - decision singola
 *  - dettaglio mail singola
 *
 * NESSUNA logica: solo SELECT.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FunnemailFolder {
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  section: "operative" | "archive" | "sorting";
  sort_order: number;
  accept_into_agenda: boolean;
  prompt_hint: string | null;
}

export interface FunnemailDecisionRow {
  id: string;
  message_id: string;
  folder_slug: string | null;
  suggested_action: "none" | "draft_reply" | "forward" | "escalate" | "archive" | "notify_human";
  goes_to_agenda: boolean;
  urgency: "critical" | "high" | "normal" | "low";
  confidence: number;
  reasoning: string | null;
  commercial_handoff: boolean;
  from_address: string | null;
  partner_id: string | null;
  override_folder_slug: string | null;
  created_at: string;
}

export interface FunnemailMailRow {
  message_id: string;
  subject: string | null;
  from_address: string | null;
  body_text: string | null;
  body_html: string | null;
  email_date: string | null;
  partner_id: string | null;
  decision: FunnemailDecisionRow | null;
  sender_intel?: SenderIntelRow | null;
}

export interface SenderIntelRow {
  email_domain: string;
  is_known_partner: boolean;
  partner_id: string | null;
  company_type: string | null;
  country: string | null;
  website: string | null;
  role_guess: string | null;
}

/** Carica intel Scout per un dominio (best-effort, non throwa). */
export async function getSenderIntelByDomain(domain: string): Promise<SenderIntelRow | null> {
  if (!domain) return null;
  // deno-lint-ignore no-explicit-any
  const { data } = await (supabase as any)
    .from("funnemail_sender_intel")
    .select("email_domain,is_known_partner,partner_id,company_type,country,website,role_guess")
    .eq("email_domain", domain.toLowerCase())
    .maybeSingle();
  return (data as SenderIntelRow | null) ?? null;
}

/** Lista cartelle attive ordinate per sezione e sort_order. */
export async function listFunnemailFolders(): Promise<FunnemailFolder[]> {
  // deno-lint-ignore no-explicit-any
  const { data, error } = await (supabase as any)
    .from("funnemail_folders")
    .select("slug,label,description,icon,section,sort_order,accept_into_agenda,prompt_hint")
    .eq("is_active", true)
    .order("section", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FunnemailFolder[];
}

/** Conteggio decisioni per slug negli ultimi 30 giorni. */
export async function countFunnemailByFolder(): Promise<Record<string, number>> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  // deno-lint-ignore no-explicit-any
  const { data, error } = await (supabase as any)
    .from("funnemail_decisions")
    .select("folder_slug")
    .gte("created_at", since)
    .limit(5000);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ folder_slug: string | null }>) {
    const k = row.folder_slug ?? "to_sort";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * Lista mail in una cartella: join logico (in JS) tra funnemail_decisions e
 * channel_messages tramite message_id_external.
 */
export async function listMailsByFolder(
  folderSlug: string,
  limit = 50,
): Promise<FunnemailMailRow[]> {
  // deno-lint-ignore no-explicit-any
  const sb = supabase as any;
  const { data: decisions, error: dErr } = await sb
    .from("funnemail_decisions")
    .select("*")
    .eq("folder_slug", folderSlug)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (dErr) throw dErr;
  const rows = (decisions ?? []) as FunnemailDecisionRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.message_id);
  const { data: msgs, error: mErr } = await sb
    .from("channel_messages")
    .select("message_id_external,subject,from_address,body_text,body_html,email_date,partner_id")
    .eq("channel", "email")
    .eq("direction", "inbound")
    .in("message_id_external", ids);
  if (mErr) throw mErr;

  const byId = new Map<string, {
    subject: string | null;
    from_address: string | null;
    body_text: string | null;
    body_html: string | null;
    email_date: string | null;
    partner_id: string | null;
  }>();
  for (const m of (msgs ?? []) as Array<{ message_id_external: string } & Record<string, unknown>>) {
    byId.set(m.message_id_external, {
      subject: (m.subject as string | null) ?? null,
      from_address: (m.from_address as string | null) ?? null,
      body_text: (m.body_text as string | null) ?? null,
      body_html: (m.body_html as string | null) ?? null,
      email_date: (m.email_date as string | null) ?? null,
      partner_id: (m.partner_id as string | null) ?? null,
    });
  }

  return rows.map((r) => {
    const meta = byId.get(r.message_id);
    return {
      message_id: r.message_id,
      subject: meta?.subject ?? null,
      from_address: meta?.from_address ?? r.from_address ?? null,
      body_text: meta?.body_text ?? null,
      body_html: meta?.body_html ?? null,
      email_date: meta?.email_date ?? r.created_at,
      partner_id: meta?.partner_id ?? r.partner_id ?? null,
      decision: r,
    };
  });
}

/** Decision singola per message_id. */
export async function getFunnemailDecision(
  messageId: string,
): Promise<FunnemailDecisionRow | null> {
  // deno-lint-ignore no-explicit-any
  const { data, error } = await (supabase as any)
    .from("funnemail_decisions")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) throw error;
  return (data as FunnemailDecisionRow | null) ?? null;
}

/** Override manuale della cartella scelta dall'AI. */
export async function overrideFunnemailFolder(
  messageId: string,
  newFolderSlug: string,
): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const { error } = await (supabase as any)
    .from("funnemail_decisions")
    .update({
      override_folder_slug: newFolderSlug,
      override_at: new Date().toISOString(),
    })
    .eq("message_id", messageId);
  if (error) throw error;
}