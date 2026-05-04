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
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { ChannelMessage } from "@/hooks/useChannelMessages";

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

const MESSAGE_LIST_SELECT = [
  "id",
  "user_id",
  "channel",
  "direction",
  "source_type",
  "source_id",
  "partner_id",
  "from_address",
  "to_address",
  "cc_addresses",
  "bcc_addresses",
  "subject",
  "body_text",
  "raw_payload",
  "message_id_external",
  "in_reply_to",
  "read_at",
  "created_at",
  "email_date",
  "raw_storage_path",
  "raw_sha256",
  "raw_size_bytes",
  "imap_uid",
  "uidvalidity",
  "imap_flags",
  "internal_date",
  "parse_status",
  "parse_warnings",
  "thread_id",
  "references_header",
].join(", ");

export interface FunnemailGroupFolder {
  slug: string;
  label: string;
  icon: string | null;
  color: string | null;
  section: "priority" | "secondary" | "unclassified";
  sort_order: number;
}

export interface FunnemailGroupedInbox {
  folders: FunnemailGroupFolder[];
  counts: Record<string, number>;
  messages: Array<ChannelMessage & { funnemail_group_slug: string; funnemail_group_name: string | null }>;
}

interface EmailSenderGroupRow {
  id: string;
  nome_gruppo: string;
  colore: string | null;
  icon: string | null;
  sort_order: number | null;
}

interface EmailAddressRuleRow {
  email_address: string;
  group_name: string | null;
}

const FUNNEMAIL_QUERY_PAGE_SIZE = 500;

interface QueryPage<T> {
  data: T[] | null;
  error: Error | null;
}

async function fetchAllPages<T>(createQuery: (from: number, to: number) => PromiseLike<QueryPage<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += FUNNEMAIL_QUERY_PAGE_SIZE) {
    const to = from + FUNNEMAIL_QUERY_PAGE_SIZE - 1;
    const { data, error } = await createQuery(from, to);
    if (error) throw error;
    const page = data ?? [];
    out.push(...page);
    if (page.length < FUNNEMAIL_QUERY_PAGE_SIZE) return out;
  }
}

function extractEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  return addr || null;
}

function slugifyGroup(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "group";
}

/** Carica intel Scout per un dominio (best-effort, non throwa). */
export async function getSenderIntelByDomain(domain: string): Promise<SenderIntelRow | null> {
  if (!domain) return null;
  const { data } = await untypedFrom("funnemail_sender_intel")
    .select("email_domain,is_known_partner,partner_id,company_type,country,website,role_guess")
    .eq("email_domain", domain.toLowerCase())
    .maybeSingle();
  return (data as SenderIntelRow | null) ?? null;
}

/** Lista cartelle attive ordinate per sezione e sort_order. */
export async function listFunnemailFolders(): Promise<FunnemailFolder[]> {
  const { data, error } = await untypedFrom("funnemail_folders")
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
  const { data, error } = await untypedFrom("funnemail_decisions")
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
  const { data: decisions, error: dErr } = await untypedFrom("funnemail_decisions")
    .select("*")
    .eq("folder_slug", folderSlug)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (dErr) throw dErr;
  const rows = (decisions ?? []) as FunnemailDecisionRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.message_id);
  const { data: msgs, error: mErr } = await untypedFrom("channel_messages")
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
  const { data, error } = await untypedFrom("funnemail_decisions")
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
  const { error } = await untypedFrom("funnemail_decisions")
    .update({
      override_folder_slug: newFolderSlug,
      override_at: new Date().toISOString(),
    })
    .eq("message_id", messageId);
  if (error) throw error;
}

/**
 * Client posta Funnemail: stessa sorgente della Inbox, raggruppata per gruppi
 * già lavorati in Funny Mail. Chi non ha regola finisce in "Non classificate".
 */
export async function listFunnemailGroupedInbox(
  userId: string,
): Promise<FunnemailGroupedInbox> {
  const [messages, groups, rules] = await Promise.all([
    fetchAllPages<ChannelMessage>((from, to) => untypedFrom("channel_messages")
      .select(MESSAGE_LIST_SELECT)
      .eq("channel", "email")
      .eq("direction", "inbound")
      .order("email_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to)),
    fetchAllPages<EmailSenderGroupRow>((from, to) => untypedFrom("email_sender_groups")
      .select("id,nome_gruppo,colore,icon,sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .range(from, to)),
    fetchAllPages<EmailAddressRuleRow>((from, to) => untypedFrom("email_address_rules")
      .select("email_address,group_name")
      .eq("user_id", userId)
      .range(from, to)),
  ]);

  const groupRows = groups;
  const ruleRows = rules;
  const groupByName = new Map(groupRows.map((g) => [g.nome_gruppo, g]));
  const rulesByAddress = new Map<string, string>();
  const rulesByDomain = new Map<string, string>();

  for (const rule of ruleRows) {
    if (!rule.email_address || !rule.group_name) continue;
    const key = rule.email_address.trim().toLowerCase();
    if (key.startsWith("@")) rulesByDomain.set(key.slice(1), rule.group_name);
    else if (!key.includes("@")) rulesByDomain.set(key, rule.group_name);
    else rulesByAddress.set(key, rule.group_name);
  }

  // Prioritarie di default: solo le 3 cartelle core operative.
  // Lo Spam non è MAI prioritario. L'utente può poi riordinare via drag&drop
  // (preferenza salvata in localStorage lato client).
  const PRIORITY_NAMES = new Set(["operativo", "commerciale", "amministrativo"]);
  const folders: FunnemailGroupFolder[] = groupRows.map((g, index) => {
    const order = g.sort_order ?? index;
    const norm = g.nome_gruppo.trim().toLowerCase();
    return {
      slug: slugifyGroup(g.nome_gruppo),
      label: g.nome_gruppo,
      icon: g.icon,
      color: g.colore,
      section: PRIORITY_NAMES.has(norm) ? "priority" : "secondary",
      sort_order: order,
    };
  });
  folders.push({ slug: "unclassified", label: "Non classificate", icon: "?", color: null, section: "unclassified", sort_order: 9999 });

  const folderSlugByName = new Map(folders.map((f) => [f.label, f.slug]));
  const counts: Record<string, number> = Object.fromEntries(folders.map((f) => [f.slug, 0]));

  const groupedMessages = messages.map((message) => {
    const address = extractEmail(message.from_address);
    const domain = address?.split("@")[1] ?? null;
    const groupName = address ? rulesByAddress.get(address) ?? (domain ? rulesByDomain.get(domain) : undefined) : undefined;
    const knownGroup = groupName ? groupByName.get(groupName) : undefined;
    const slug = knownGroup ? folderSlugByName.get(knownGroup.nome_gruppo) ?? slugifyGroup(knownGroup.nome_gruppo) : "unclassified";
    counts[slug] = (counts[slug] ?? 0) + 1;
    return { ...message, funnemail_group_slug: slug, funnemail_group_name: knownGroup?.nome_gruppo ?? null };
  });

  return { folders, counts, messages: groupedMessages };
}