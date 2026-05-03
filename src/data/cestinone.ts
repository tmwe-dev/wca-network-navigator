/**
 * DAL — Cestinone (unified pre-send queue)
 *
 * Aggrega le sorgenti che oggi rappresentano "azioni in attesa di
 * conferma/invio":
 *   - email_campaign_queue   (pending / queued / scheduled)
 *   - campaign_jobs          (pending / queued / scheduled)
 *   - cockpit_queue          (queued)
 *   - outreach_queue         (pending)
 *
 * Niente nuove tabelle, niente DB write paths nuovi: questa è la "vista"
 * unica, la conferma fisica continua a passare dai canali esistenti
 * (editorial review intoccato).
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { emitBusyPartnersChanged } from "@/v2/hooks/useBusyPartners";

export type CestinoChannel = "email" | "whatsapp" | "linkedin" | "voice" | "other";
export type CestinoSource =
  | "email_campaign_queue"
  | "campaign_jobs"
  | "cockpit_queue"
  | "outreach_queue";
export type CestinoStatus = "pending" | "queued" | "scheduled" | "blocked" | "draft";
export type CestinoTrigger =
  | "campaign"
  | "inbound_reply"
  | "mission"
  | "manual"
  | "auto_touch"
  | "cockpit_draft";
export type CestinoPartnerType = "wca_partner" | "customer" | "lead" | "prospect" | null;

export interface CestinoInteraction {
  readonly date: string;
  readonly channel: string;
  readonly direction: "in" | "out" | "note";
  readonly subject: string | null;
  readonly snippet: string | null;
}

export interface CestinoOriginContext {
  /** Provenienza primaria (BCA, fiera, import, manuale, scraping). */
  readonly source: "business_card" | "campaign" | "inbound_reply" | "manual" | "import" | "unknown";
  /** Etichetta human-readable della provenienza. */
  readonly label: string;
  /** Es. nome fiera per BCA. */
  readonly eventName?: string | null;
  /** Es. luogo di incontro per BCA. */
  readonly meetingLocation?: string | null;
  /** Data dell'incontro / acquisizione. */
  readonly acquiredAt?: string | null;
}

export interface CestinoItem {
  readonly id: string;
  readonly source: CestinoSource;
  readonly channel: CestinoChannel;
  readonly status: CestinoStatus;
  readonly partnerId: string | null;
  readonly recipientName: string | null;
  readonly recipientHandle: string | null; // email / phone / li url
  readonly subject: string | null;
  readonly preview: string | null;
  readonly scheduledAt: string | null;
  readonly createdAt: string;
  // identità arricchita
  readonly partnerName: string | null;
  readonly partnerType: CestinoPartnerType;
  readonly partnerCountryCode: string | null;
  readonly partnerCountryName: string | null;
  readonly partnerLeadStatus: string | null;
  readonly partnerWcaId: number | null;
  // contesto
  readonly agentName: string | null;
  readonly campaignName: string | null;
  readonly triggerKind: CestinoTrigger;
  readonly originContext: CestinoOriginContext;
  /** Email/messaggio precedente che ha generato questa risposta, se presente. */
  readonly previousMessage: { readonly subject: string | null; readonly snippet: string | null; readonly date: string } | null;
  /** Ultime interazioni con il partner (max 5). */
  readonly recentInteractions: ReadonlyArray<CestinoInteraction>;
  // contenuto pieno
  readonly bodyText: string | null;
  readonly bodyHtml: string | null;
  // segnali operativi
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly lastError: string | null;
  // intelligence
  readonly deepSearchDoneAt: string | null;
}

const COUNTRY_NAMER = (() => {
  try { return new Intl.DisplayNames(["it"], { type: "region" }); }
  catch { return null; }
})();
function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try { return COUNTRY_NAMER?.of(code.toUpperCase()) ?? code.toUpperCase(); }
  catch { return code.toUpperCase(); }
}

function normalizeStatus(raw: string | null | undefined): CestinoStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "scheduled") return "scheduled";
  if (s === "queued" || s === "sending") return "queued";
  if (s === "blocked" || s === "failed") return "blocked";
  if (s === "draft") return "draft";
  return "pending";
}

function detectChannel(channel?: string | null): CestinoChannel {
  const c = (channel ?? "email").toLowerCase();
  if (c.includes("whatsapp") || c === "wa") return "whatsapp";
  if (c.includes("linkedin") || c === "li") return "linkedin";
  if (c.includes("voice") || c.includes("phone") || c.includes("call")) return "voice";
  if (c.includes("email") || c === "mail") return "email";
  return "other";
}

function detectPartnerType(p: { partner_type?: string | null; lead_status?: string | null; wca_id?: number | null }): CestinoPartnerType {
  const t = (p.partner_type ?? "").toLowerCase();
  const ls = (p.lead_status ?? "").toLowerCase();
  if (ls === "active_customer" || ls === "customer" || t === "customer") return "customer";
  if (p.wca_id) return "wca_partner";
  if (ls === "lead" || ls === "qualified_lead") return "lead";
  if (t === "prospect" || ls === "prospect") return "prospect";
  return p.wca_id ? "wca_partner" : "lead";
}

/**
 * Carica la coda unificata. Usa Promise.allSettled per non far fallire
 * tutto se una sorgente non risponde.
 */
export async function fetchCestinone(): Promise<CestinoItem[]> {
  const out: CestinoItem[] = [];

  const [emailQ, campaignQ, cockpitQ, outreachQ] = await Promise.allSettled([
    supabase
      .from("email_campaign_queue")
      .select("id, partner_id, recipient_name, recipient_email, subject, html_body, status, scheduled_at, created_at, retry_count, error_message, operator_id")
      .in("status", ["pending", "queued", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(500),
    untypedFrom("campaign_jobs")
      .select("id, partner_id, company_name, country_code, email, phone, job_type, status, batch_id, created_at, operator_id, notes, assigned_to")
      .in("status", ["pending", "queued", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("cockpit_queue")
      .select("id, partner_id, source_type, source_id, status, created_at, operator_id")
      .eq("status", "queued")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("outreach_queue")
      .select("id, partner_id, channel, recipient_name, recipient_email, recipient_phone, recipient_linkedin_url, subject, body, status, created_at, attempts, max_attempts, last_error, operator_id, created_by")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (emailQ.status === "fulfilled" && emailQ.value.data) {
    for (const r of emailQ.value.data as Array<Record<string, unknown>>) {
      out.push({
        id: `eq:${String(r.id)}`,
        source: "email_campaign_queue",
        channel: "email",
        status: normalizeStatus(r.status as string),
        partnerId: (r.partner_id as string) ?? null,
        recipientName: (r.recipient_name as string) ?? null,
        recipientHandle: (r.recipient_email as string) ?? null,
        subject: (r.subject as string) ?? null,
        preview: r.html_body ? stripHtml(String(r.html_body)).slice(0, 220) : null,
        scheduledAt: (r.scheduled_at as string) ?? null,
        createdAt: String(r.created_at ?? new Date().toISOString()),
        partnerName: null,
        partnerType: null,
        partnerCountryCode: null,
        partnerCountryName: null,
        partnerLeadStatus: null,
        partnerWcaId: null,
        agentName: (r.operator_id as string) ?? null,
        campaignName: null,
        triggerKind: "campaign",
        originContext: { source: "campaign", label: "Coda email campagne" },
        previousMessage: null,
        recentInteractions: [],
        bodyText: null,
        bodyHtml: (r.html_body as string) ?? null,
        retryCount: Number(r.retry_count ?? 0),
        maxRetries: 3,
        lastError: (r.error_message as string) ?? null,
        deepSearchDoneAt: null,
      });
    }
  }

  if (campaignQ.status === "fulfilled" && campaignQ.value.data) {
    for (const r of campaignQ.value.data as Array<Record<string, unknown>>) {
      const notes = (r.notes as string) ?? null;
      const handle = (r.email as string) ?? (r.phone as string) ?? null;
      out.push({
        id: `cj:${String(r.id)}`,
        source: "campaign_jobs",
        channel: detectChannel(String(r.job_type ?? "")),
        status: normalizeStatus(r.status as string),
        partnerId: (r.partner_id as string) ?? null,
        recipientName: (r.company_name as string) ?? null,
        recipientHandle: handle,
        subject: String(r.job_type ?? "Job"),
        preview: notes ? notes.slice(0, 220) : null,
        scheduledAt: null,
        createdAt: String(r.created_at ?? new Date().toISOString()),
        partnerName: (r.company_name as string) ?? null,
        partnerType: null,
        partnerCountryCode: (r.country_code as string) ?? null,
        partnerCountryName: countryName(r.country_code as string),
        partnerLeadStatus: null,
        partnerWcaId: null,
        agentName: (r.operator_id as string) ?? (r.assigned_to as string) ?? null,
        campaignName: r.batch_id ? `Batch ${String(r.batch_id).slice(0, 8)}` : null,
        triggerKind: "campaign",
        originContext: { source: "campaign", label: r.batch_id ? `Job campagna · Batch ${String(r.batch_id).slice(0, 8)}` : "Job campagna" },
        previousMessage: null,
        recentInteractions: [],
        bodyText: notes,
        bodyHtml: null,
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        deepSearchDoneAt: null,
      });
    }
  }

  if (cockpitQ.status === "fulfilled" && cockpitQ.value.data) {
    for (const r of cockpitQ.value.data as Array<Record<string, unknown>>) {
      out.push({
        id: `cq:${String(r.id)}`,
        source: "cockpit_queue",
        channel: detectChannel(String(r.source_type ?? "")),
        status: normalizeStatus(r.status as string),
        partnerId: (r.partner_id as string) ?? null,
        recipientName: null,
        recipientHandle: null,
        subject: String(r.source_type ?? "Cockpit item"),
        preview: null,
        scheduledAt: null,
        createdAt: String(r.created_at ?? new Date().toISOString()),
        partnerName: null,
        partnerType: null,
        partnerCountryCode: null,
        partnerCountryName: null,
        partnerLeadStatus: null,
        partnerWcaId: null,
        agentName: (r.operator_id as string) ?? null,
        campaignName: null,
        triggerKind: "cockpit_draft",
        originContext: { source: "manual", label: "Cockpit (bozza operatore)" },
        previousMessage: null,
        recentInteractions: [],
        bodyText: null,
        bodyHtml: null,
        retryCount: 0,
        maxRetries: 1,
        lastError: null,
        deepSearchDoneAt: null,
      });
    }
  }

  if (outreachQ.status === "fulfilled" && outreachQ.value.data) {
    for (const r of outreachQ.value.data as Array<Record<string, unknown>>) {
      const ch = detectChannel(r.channel as string);
      const handle =
        ch === "whatsapp" ? (r.recipient_phone as string) :
        ch === "linkedin" ? (r.recipient_linkedin_url as string) :
        (r.recipient_email as string);
      const body = (r.body as string) ?? null;
      const isReply = String(r.created_by ?? "").includes("reply");
      out.push({
        id: `oq:${String(r.id)}`,
        source: "outreach_queue",
        channel: ch,
        status: normalizeStatus(r.status as string),
        partnerId: (r.partner_id as string) ?? null,
        recipientName: (r.recipient_name as string) ?? null,
        recipientHandle: handle ?? null,
        subject: (r.subject as string) ?? null,
        preview: body ? body.slice(0, 220) : null,
        scheduledAt: null,
        createdAt: String(r.created_at ?? new Date().toISOString()),
        partnerName: null,
        partnerType: null,
        partnerCountryCode: null,
        partnerCountryName: null,
        partnerLeadStatus: null,
        partnerWcaId: null,
        agentName: (r.operator_id as string) ?? (r.created_by as string) ?? null,
        campaignName: null,
        triggerKind: isReply ? "inbound_reply" : "manual",
        originContext: { source: isReply ? "inbound_reply" : "manual", label: isReply ? "Risposta a messaggio inbound" : "Outreach manuale multicanale" },
        previousMessage: null,
        recentInteractions: [],
        bodyText: body,
        bodyHtml: null,
        retryCount: Number(r.attempts ?? 0),
        maxRetries: Number(r.max_attempts ?? 3),
        lastError: (r.last_error as string) ?? null,
        deepSearchDoneAt: null,
      });
    }
  }

  // === ENRICHMENT BATCH (partners + profiles + sherlock) ===
  const partnerIds = Array.from(new Set(out.map((i) => i.partnerId).filter(Boolean) as string[]));
  const operatorIds = Array.from(new Set(out.map((i) => i.agentName).filter((v): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v))));

  const [partnersRes, profilesRes, sherlockRes, bcaRes, interactionsRes, lastInboundRes] = await Promise.allSettled([
    partnerIds.length
      ? supabase.from("partners").select("id, company_name, country_code, country_name, city, lead_status, partner_type, wca_id").in("id", partnerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    operatorIds.length
      ? supabase.from("profiles").select("user_id, display_name").in("user_id", operatorIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    partnerIds.length
      ? supabase.from("sherlock_investigations").select("partner_id, created_at").in("partner_id", partnerIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    partnerIds.length
      ? supabase.from("business_cards").select("matched_partner_id, event_name, location, met_at").in("matched_partner_id", partnerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    partnerIds.length
      ? supabase.from("interactions").select("partner_id, interaction_type, interaction_date, subject, notes").in("partner_id", partnerIds).order("interaction_date", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    partnerIds.length
      ? supabase.from("channel_messages").select("partner_id, channel, direction, subject, body_text, created_at").in("partner_id", partnerIds).eq("direction", "inbound").order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const partnerMap = new Map<string, Record<string, unknown>>();
  if (partnersRes.status === "fulfilled" && partnersRes.value.data) {
    for (const p of partnersRes.value.data as Array<Record<string, unknown>>) {
      partnerMap.set(String(p.id), p);
    }
  }
  const profileMap = new Map<string, string>();
  if (profilesRes.status === "fulfilled" && profilesRes.value.data) {
    for (const p of profilesRes.value.data as Array<Record<string, unknown>>) {
      profileMap.set(String(p.user_id), String(p.display_name ?? ""));
    }
  }
  const sherlockMap = new Map<string, string>();
  if (sherlockRes.status === "fulfilled" && sherlockRes.value.data) {
    for (const s of sherlockRes.value.data as Array<Record<string, unknown>>) {
      const pid = String(s.partner_id);
      if (!sherlockMap.has(pid)) sherlockMap.set(pid, String(s.created_at));
    }
  }
  const bcaMap = new Map<string, { event: string | null; location: string | null; met_at: string | null }>();
  if (bcaRes.status === "fulfilled" && bcaRes.value.data) {
    for (const c of bcaRes.value.data as Array<Record<string, unknown>>) {
      const pid = String(c.matched_partner_id);
      if (!bcaMap.has(pid)) bcaMap.set(pid, {
        event: (c.event_name as string) ?? null,
        location: (c.location as string) ?? null,
        met_at: (c.met_at as string) ?? null,
      });
    }
  }
  const interactionsByPartner = new Map<string, CestinoInteraction[]>();
  if (interactionsRes.status === "fulfilled" && interactionsRes.value.data) {
    for (const i of interactionsRes.value.data as Array<Record<string, unknown>>) {
      const pid = String(i.partner_id);
      const arr = interactionsByPartner.get(pid) ?? [];
      if (arr.length >= 5) continue;
      arr.push({
        date: String(i.interaction_date ?? ""),
        channel: String(i.interaction_type ?? "—"),
        direction: "note",
        subject: (i.subject as string) ?? null,
        snippet: i.notes ? String(i.notes).slice(0, 160) : null,
      });
      interactionsByPartner.set(pid, arr);
    }
  }
  const lastInboundByPartner = new Map<string, { subject: string | null; snippet: string | null; date: string }>();
  if (lastInboundRes.status === "fulfilled" && lastInboundRes.value.data) {
    for (const m of lastInboundRes.value.data as Array<Record<string, unknown>>) {
      const pid = String(m.partner_id);
      if (lastInboundByPartner.has(pid)) continue;
      lastInboundByPartner.set(pid, {
        subject: (m.subject as string) ?? null,
        snippet: m.body_text ? String(m.body_text).replace(/\s+/g, " ").slice(0, 220) : null,
        date: String(m.created_at ?? ""),
      });
    }
  }

  const enriched = out.map((it): CestinoItem => {
    const p = it.partnerId ? partnerMap.get(it.partnerId) : null;
    const agentDisplay = it.agentName && profileMap.has(it.agentName)
      ? profileMap.get(it.agentName) || it.agentName
      : it.agentName;
    const bca = it.partnerId ? bcaMap.get(it.partnerId) : null;
    const previous = it.partnerId ? lastInboundByPartner.get(it.partnerId) ?? null : null;
    const interactions = it.partnerId ? interactionsByPartner.get(it.partnerId) ?? [] : [];
    let originContext = it.originContext;
    // se è una risposta o il partner viene da BCA, sovrascrivo il context per essere più informativo
    if (it.triggerKind === "inbound_reply" && previous) {
      originContext = { ...originContext, source: "inbound_reply", label: "Risposta a email ricevuta" };
    } else if (bca) {
      originContext = {
        source: "business_card",
        label: bca.event ? `Biglietto da visita · ${bca.event}` : "Biglietto da visita",
        eventName: bca.event,
        meetingLocation: bca.location,
        acquiredAt: bca.met_at,
      };
    }
    const code = (p?.country_code as string) ?? it.partnerCountryCode;
    const cName = (p?.country_name as string) ?? countryName(code);
    return {
      ...it,
      partnerName: (p?.company_name as string) ?? it.partnerName,
      partnerCountryCode: code,
      partnerCountryName: cName,
      partnerLeadStatus: (p?.lead_status as string) ?? null,
      partnerWcaId: (p?.wca_id as number) ?? null,
      partnerType: p ? detectPartnerType({
        partner_type: p.partner_type as string,
        lead_status: p.lead_status as string,
        wca_id: p.wca_id as number,
      }) : null,
      agentName: agentDisplay || null,
      deepSearchDoneAt: it.partnerId ? sherlockMap.get(it.partnerId) ?? null : null,
      originContext,
      previousMessage: it.triggerKind === "inbound_reply" ? previous : null,
      recentInteractions: interactions,
    };
  });

  // Ordina per più urgente: scheduled prima, poi più vecchio
  enriched.sort((a, b) => {
    const aS = a.scheduledAt ? Date.parse(a.scheduledAt) : Date.parse(a.createdAt);
    const bS = b.scheduledAt ? Date.parse(b.scheduledAt) : Date.parse(b.createdAt);
    return aS - bS;
  });

  return enriched;
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Annulla un item. Soft-delete: il trigger DB converte DELETE in UPDATE
 * deleted_at sulle tabelle business; per cockpit_queue la riga viene
 * fisicamente rimossa (è una coda di lavoro, non un record business).
 */
export async function cancelCestinoItem(item: CestinoItem): Promise<void> {
  const realId = item.id.split(":")[1];
  if (!realId) throw new Error("invalid cestinone id");

  switch (item.source) {
    case "email_campaign_queue": {
      const { error } = await supabase
        .from("email_campaign_queue")
        .update({ status: "cancelled" } as never)
        .eq("id", realId);
      if (error) throw error;
      break;
    }
    case "campaign_jobs": {
      const { error } = await untypedFrom("campaign_jobs")
        .update({ status: "cancelled" })
        .eq("id", realId);
      if (error) throw error;
      break;
    }
    case "cockpit_queue": {
      const { error } = await supabase
        .from("cockpit_queue")
        .delete()
        .eq("id", realId);
      if (error) throw error;
      break;
    }
    case "outreach_queue": {
      const { error } = await supabase
        .from("outreach_queue")
        .update({ status: "cancelled" } as never)
        .eq("id", realId);
      if (error) throw error;
      break;
    }
  }

  emitBusyPartnersChanged();
}

/**
 * Rinvia (snooze) — sposta scheduled_at avanti di N minuti.
 * Solo le sorgenti che supportano scheduled_at.
 */
export async function snoozeCestinoItem(item: CestinoItem, minutes = 60): Promise<void> {
  const realId = item.id.split(":")[1];
  if (!realId) throw new Error("invalid cestinone id");
  const newAt = new Date(Date.now() + minutes * 60_000).toISOString();

  if (item.source === "email_campaign_queue") {
    const { error } = await supabase
      .from("email_campaign_queue")
      .update({ scheduled_at: newAt, status: "scheduled" } as never)
      .eq("id", realId);
    if (error) throw error;
  } else if (item.source === "campaign_jobs") {
    const { error } = await untypedFrom("campaign_jobs")
      .update({ scheduled_at: newAt, status: "scheduled" })
      .eq("id", realId);
    if (error) throw error;
  }

  emitBusyPartnersChanged();
}