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

export interface FunnemailPartnerSnapshot {
  id: string;
  company_name: string;
  company_alias: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  logo_url: string | null;
  lead_status: string | null;
  partner_type: string | null;
  website: string | null;
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
  "category",
  "folder",
  "ai_classification_suggestion",
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
  section: "operative" | "archive" | "sorting" | "priority" | "secondary" | "unclassified";
  sort_order: number;
  auto_mark_read?: boolean;
}

export interface FunnemailGroupedInbox {
  folders: FunnemailGroupFolder[];
  counts: Record<string, number>;
  messages: Array<ChannelMessage & {
    funnemail_group_slug: string;
    funnemail_group_name: string | null;
    funnemail_folder_label: string | null;
    funnemail_folder_icon: string | null;
    funnemail_decision: FunnemailDecisionRow | null;
    sender_intel: SenderIntelRow | null;
    partner_snapshot: FunnemailPartnerSnapshot | null;
  }>;
}

interface EmailSenderGroupRow {
  id: string;
  nome_gruppo: string;
  colore: string | null;
  icon: string | null;
  sort_order: number | null;
  funnemail_policy?: { auto_mark_read?: boolean } | null;
}

interface EmailAddressRuleRow {
  email_address: string;
  group_name: string | null;
}

const FUNNEMAIL_QUERY_PAGE_SIZE = 500;
/**
 * Cap di sicurezza per evitare freeze del browser:
 * - messaggi: ultimi 1000 (≈2 pagine) — più che sufficiente per la inbox attiva
 * - regole/gruppi: 2000 — copre installazioni grandi senza loop infiniti
 * Il loop precedente (`fetchAllPages` senza tetto) congelava la UI su account
 * con decine di migliaia di email, soprattutto in modalità "viewingAll".
 */
const MAX_MESSAGES = 1000;
const MAX_RULES_OR_GROUPS = 2000;

interface QueryPage<T> {
  data: T[] | null;
  error: Error | null;
}

async function fetchAllPages<T>(
  createQuery: (from: number, to: number) => PromiseLike<QueryPage<T>>,
  maxRows = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += FUNNEMAIL_QUERY_PAGE_SIZE) {
    const to = from + FUNNEMAIL_QUERY_PAGE_SIZE - 1;
    const { data, error } = await createQuery(from, to);
    if (error) throw error;
    const page = data ?? [];
    out.push(...page);
    if (page.length < FUNNEMAIL_QUERY_PAGE_SIZE) return out;
    if (out.length >= maxRows) return out.slice(0, maxRows);
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

export async function markFunnemailMessagesRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const { error } = await untypedFrom("channel_messages")
    .update({ read_at: new Date().toISOString() })
    .in("id", messageIds);
  if (error) throw error;
}

/**
 * Client posta Funnemail: stessa sorgente della Inbox, raggruppata per gruppi
 * già lavorati in Funny Mail. Chi non ha regola finisce in "Non classificate".
 */
export async function listFunnemailGroupedInbox(
  userId: string,
  targetUserId?: string | null,
): Promise<FunnemailGroupedInbox> {
  // `userId` = utente loggato (per regole/gruppi personali).
  // `targetUserId` = utente di cui vogliamo vedere le email (impersonation).
  //   - null/undefined => "tutti gli operatori" (RLS decide la visibilità).
  //   - stringa        => filtra channel_messages.user_id su quell'operatore.
  //
  // Le cartelle sono i CONTENITORI Funnemail (funnemail_folders): Offerte/RFQ,
  // Operations, Tasks, Supporto, Chat interna, Alert, Info, Newsletter, No-Reply,
  // Promo, Spam, Archivio, Da smistare. Sono diverse dai gruppi mittente di
  // Funny Mail (es. "fornitore Bosch") perché una mail dello stesso mittente
  // può essere una fattura (Amministrativo) o una RFQ (Offerte) — il
  // classificatore Funnemail decide il contenitore.
  const [messages, foldersData, decisions, groups, rules] = await Promise.all([
    fetchAllPages<ChannelMessage>((from, to) => {
      let q = untypedFrom("channel_messages")
        .select(MESSAGE_LIST_SELECT)
        .eq("channel", "email")
        .eq("direction", "inbound");
      if (targetUserId) q = q.eq("user_id", targetUserId);
      return q
        .order("email_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to);
    }, MAX_MESSAGES),
    listFunnemailFolders(),
    fetchAllPages<{ message_id: string; folder_slug: string | null; override_folder_slug: string | null }>(
      (from, to) => untypedFrom("funnemail_decisions")
        .select("message_id, folder_slug, override_folder_slug")
        .order("created_at", { ascending: false })
        .range(from, to),
      MAX_MESSAGES,
    ),
    fetchAllPages<EmailSenderGroupRow>((from, to) => untypedFrom("email_sender_groups")
      .select("id,nome_gruppo,colore,icon,sort_order,funnemail_policy")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .range(from, to), MAX_RULES_OR_GROUPS),
    fetchAllPages<EmailAddressRuleRow>((from, to) => untypedFrom("email_address_rules")
      .select("email_address,group_name,category")
      .eq("user_id", userId)
      .range(from, to), MAX_RULES_OR_GROUPS),
  ]);

  // Mappa funnemail_folders -> FunnemailGroupFolder.
  // Ordine: operative (priorità) > sorting (Da smistare) > archive.
  const sectionOrder: Record<string, number> = { operative: 0, sorting: 1, archive: 2 };
  const folders: FunnemailGroupFolder[] = foldersData
    .slice()
    .sort((a, b) => {
      const sa = sectionOrder[a.section] ?? 9;
      const sb = sectionOrder[b.section] ?? 9;
      if (sa !== sb) return sa - sb;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    })
    .map((f) => ({
      slug: f.slug,
      label: f.label,
      icon: f.icon,
      color: null,
      section: f.section,
      sort_order: f.sort_order ?? 0,
      auto_mark_read: false,
    }));

  // Helper: mappa categoria/gruppo mittente -> slug Funnemail (fallback senza decision).
  const groupNameToFolder = (name: string | null | undefined): string | null => {
    if (!name) return null;
    const n = name.trim().toLowerCase();
    if (n.includes("offert") || n.includes("quotaz") || n.includes("rfq") || n.includes("preventiv")) return "rfq";
    if (n.includes("ammin") || n.includes("fattur") || n.includes("contab")) return "tasks";
    if (n.includes("operat") || n.includes("logist") || n.includes("spediz")) return "operations";
    if (n.includes("support") || n.includes("assist") || n.includes("recl")) return "support";
    if (n.includes("commerc") || n.includes("vend")) return "rfq";
    if (n.includes("newsletter")) return "newsletter";
    if (n.includes("spam")) return "spam";
    if (n.includes("promo") || n.includes("ads")) return "ads";
    if (n.includes("notif") || n.includes("no-reply") || n.includes("noreply")) return "no_reply";
    if (n.includes("alert") || n.includes("urgen")) return "alerts";
    if (n.includes("info")) return "info";
    if (n.includes("interna") || n.includes("collegh")) return "internal";
    return null;
  };

  // Decision-based mapping (override prevale).
  const decisionByMsgId = new Map<string, string>();
  for (const d of decisions) {
    const slug = d.override_folder_slug ?? d.folder_slug;
    if (slug && d.message_id) decisionByMsgId.set(d.message_id, slug);
  }

  // Fallback: mittente -> categoria/gruppo -> cartella.
  const ruleFolderByAddress = new Map<string, string>();
  const ruleFolderByDomain = new Map<string, string>();
  for (const rule of rules as Array<EmailAddressRuleRow & { category?: string | null }>) {
    if (!rule.email_address) continue;
    const slug = groupNameToFolder(rule.group_name) ?? groupNameToFolder(rule.category ?? null);
    if (!slug) continue;
    const key = rule.email_address.trim().toLowerCase();
    if (key.startsWith("@")) ruleFolderByDomain.set(key.slice(1), slug);
    else if (!key.includes("@")) ruleFolderByDomain.set(key, slug);
    else ruleFolderByAddress.set(key, slug);
  }

  // Mantengo `groups` per evitare warning unused; sarà usato per badge futuri.
  void groups;

  const validSlugs = new Set(folders.map((f) => f.slug));
  const counts: Record<string, number> = Object.fromEntries(folders.map((f) => [f.slug, 0]));

  const groupedMessages = messages.map((message) => {
    let slug: string | null = null;
    const externalId = (message as ChannelMessage & { message_id_external?: string | null }).message_id_external ?? null;
    if (externalId) slug = decisionByMsgId.get(externalId) ?? null;
    if (!slug) {
      const address = extractEmail(message.from_address);
      const domain = address?.split("@")[1] ?? null;
      slug = (address ? ruleFolderByAddress.get(address) : undefined) ?? (domain ? ruleFolderByDomain.get(domain) : undefined) ?? null;
    }
    if (!slug || !validSlugs.has(slug)) slug = "to_sort";
    counts[slug] = (counts[slug] ?? 0) + 1;
    return { ...message, funnemail_group_slug: slug, funnemail_group_name: null };
  });

  return { folders, counts, messages: groupedMessages };
}