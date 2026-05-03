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

/**
 * Carica la coda unificata. Usa Promise.allSettled per non far fallire
 * tutto se una sorgente non risponde.
 */
export async function fetchCestinone(): Promise<CestinoItem[]> {
  const out: CestinoItem[] = [];

  const [emailQ, campaignQ, cockpitQ, outreachQ] = await Promise.allSettled([
    supabase
      .from("email_campaign_queue")
      .select("id, partner_id, recipient_name, recipient_email, subject, status, scheduled_at, created_at")
      .in("status", ["pending", "queued", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(500),
    untypedFrom("campaign_jobs")
      .select("id, partner_id, contact_name, channel, subject, body, status, scheduled_at, created_at")
      .in("status", ["pending", "queued", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("cockpit_queue")
      .select("id, partner_id, source_type, source_id, status, created_at")
      .eq("status", "queued")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("outreach_queue")
      .select("id, channel, recipient_name, recipient_email, recipient_phone, recipient_linkedin_url, subject, body, status, created_at")
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
        preview: null,
        scheduledAt: (r.scheduled_at as string) ?? null,
        createdAt: String(r.created_at ?? new Date().toISOString()),
      });
    }
  }

  if (campaignQ.status === "fulfilled" && campaignQ.value.data) {
    for (const r of campaignQ.value.data as Array<Record<string, unknown>>) {
      const body = (r.body as string) ?? null;
      out.push({
        id: `cj:${String(r.id)}`,
        source: "campaign_jobs",
        channel: detectChannel(r.channel as string),
        status: normalizeStatus(r.status as string),
        partnerId: (r.partner_id as string) ?? null,
        recipientName: (r.contact_name as string) ?? null,
        recipientHandle: null,
        subject: (r.subject as string) ?? null,
        preview: body ? body.slice(0, 140) : null,
        scheduledAt: (r.scheduled_at as string) ?? null,
        createdAt: String(r.created_at ?? new Date().toISOString()),
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
      out.push({
        id: `oq:${String(r.id)}`,
        source: "outreach_queue",
        channel: ch,
        status: normalizeStatus(r.status as string),
        partnerId: null,
        recipientName: (r.recipient_name as string) ?? null,
        recipientHandle: handle ?? null,
        subject: (r.subject as string) ?? null,
        preview: body ? body.slice(0, 140) : null,
        scheduledAt: null,
        createdAt: String(r.created_at ?? new Date().toISOString()),
      });
    }
  }

  // Ordina per più urgente: scheduled prima, poi più vecchio
  out.sort((a, b) => {
    const aS = a.scheduledAt ? Date.parse(a.scheduledAt) : Date.parse(a.createdAt);
    const bS = b.scheduledAt ? Date.parse(b.scheduledAt) : Date.parse(b.createdAt);
    return aS - bS;
  });

  return out;
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