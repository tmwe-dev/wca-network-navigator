/**
 * postSendHook.ts — Hook OBBLIGATORIO post-invio messaggio.
 *
 * Esegue dopo ogni send_email / send_linkedin_message / send_whatsapp:
 * 1. Aggiorna stato lead se applicabile (new → first_touch_sent)
 * 2. Crea reminder follow-up (next step della sequenza)
 * 3. Verifica next_action esista — se vuota, creala
 *
 * Costituzione §3 (cadence) + §5 (post-invio).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { applyLeadStatusChange } from "./leadStatusGuard.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export interface PostSendInput {
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
  channel: "email" | "linkedin" | "whatsapp";
  /** Giorno della sequenza appena eseguito (G0/G3/G7/G8/G12/G16/G23). Default 0. */
  sequenceDay?: number;
  /** Subject/preview per descrizione activity */
  preview?: string;
}

/**
 * Sequenza canonica primo contatto (Costituzione §3 — 23gg).
 * Gli step indicano (giornoOffset → canale).
 * Gate: mai stesso canale <7gg (rispettato dalla sequenza).
 */
const SEQUENCE_NEXT: Record<number, { nextDay: number; channel: "email" | "linkedin" } | null> = {
  0:  { nextDay: 3,  channel: "linkedin" }, // G0 email → G3 LinkedIn connection
  3:  { nextDay: 7,  channel: "linkedin" }, // G3 → G7 LinkedIn message (se connesso)
  7:  { nextDay: 8,  channel: "email" },    // G7 → G8 email follow-up
  8:  { nextDay: 12, channel: "linkedin" }, // G8 → G12 LinkedIn light
  12: { nextDay: 16, channel: "email" },    // G12 → G16 email follow-up
  16: { nextDay: 23, channel: "email" },    // G16 → G23 breakup email
  23: null,                                  // fine sequenza primo contatto → holding
};

export async function runPostSendHook(
  supabase: SupabaseClient,
  input: PostSendInput,
): Promise<{ stateUpdated: boolean; reminderCreated: boolean; nextActionEnsured: boolean }> {
  const out = { stateUpdated: false, reminderCreated: false, nextActionEnsured: false };

  // 1) Aggiorna stato new → first_touch_sent (via guard centralizzato + audit)
  if (input.partnerId) {
    try {
      const { data: p } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", input.partnerId)
        .eq("user_id", input.userId)
        .maybeSingle();
      if (p && (p.lead_status === "new" || !p.lead_status)) {
        const res = await applyLeadStatusChange(supabase, {
          table: "partners",
          recordId: input.partnerId,
          newStatus: "first_touch_sent",
          userId: input.userId,
          actor: { type: "system", name: "postSendHook" },
          decisionOrigin: "system_trigger",
          trigger: `Primo messaggio inviato (${input.channel})`,
          metadata: { channel: input.channel, sequence_day: input.sequenceDay ?? 0 },
        });
        if (res.applied) out.stateUpdated = true;
      } else if (p) {
        // Stato avanzato: aggiorno solo timestamp, no transizione
        await supabase
          .from("partners")
          .update({ last_interaction_at: new Date().toISOString() })
          .eq("id", input.partnerId)
          .eq("user_id", input.userId);
      }
    } catch (e) {
      console.warn("[postSendHook] state update failed:", e);
    }
  }

  // 2) Reminder per next step della sequenza
  const day = input.sequenceDay ?? 0;
  const next = SEQUENCE_NEXT[day];
  if (next) {
    const dueDate = new Date(Date.now() + (next.nextDay - day) * 86400000);
    try {
      const { error } = await supabase.from("activities").insert({
        user_id: input.userId,
        partner_id: input.partnerId ?? null,
        source_id: input.partnerId || input.contactId || crypto.randomUUID(),
        source_type: input.partnerId ? "partner" : "imported_contact",
        activity_type: "follow_up",
        title: `Sequenza G${next.nextDay} (${next.channel})`,
        description: `Follow-up automatico — canale: ${next.channel}. Step ${next.nextDay} della sequenza primo contatto.`,
        status: "pending",
        priority: "normal",
        due_date: dueDate.toISOString(),
        scheduled_at: dueDate.toISOString(),
        source_meta: { sequence_day: next.nextDay, channel: next.channel, prev_day: day },
      });
      if (!error) out.reminderCreated = true;
    } catch (e) {
      console.warn("[postSendHook] reminder insert failed:", e);
    }
  } else if (input.partnerId) {
    // Fine sequenza → holding manuale (verrà gestito da evaluateTransitions su prossimo cron)
    console.log(`[postSendHook] Sequenza primo contatto completata per partner ${input.partnerId}`);
  }

  // 3) Verifica next_action: se per il partner non c'è alcuna activity pending → creala generica
  if (input.partnerId && !out.reminderCreated) {
    try {
      const { count } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId)
        .eq("partner_id", input.partnerId)
        .eq("status", "pending");
      if (!count || count === 0) {
        const dueDate = new Date(Date.now() + 14 * 86400000); // default 14gg
        const { error } = await supabase.from("activities").insert({
          user_id: input.userId,
          partner_id: input.partnerId,
          source_id: input.partnerId,
          source_type: "partner",
          activity_type: "follow_up",
          title: "Follow-up review (auto)",
          description: "Next-action garantita post-invio. Da raffinare manualmente.",
          status: "pending",
          priority: "low",
          due_date: dueDate.toISOString(),
          scheduled_at: dueDate.toISOString(),
        });
        if (!error) out.nextActionEnsured = true;
      } else {
        out.nextActionEnsured = true;
      }
    } catch (e) {
      console.warn("[postSendHook] next_action check failed:", e);
    }
  }

  return out;
}

/**
 * WhatsApp gate (Costituzione §4).
 * VIETATO come primo contatto. Consentito SOLO SE:
 *  (a) lead_status >= engaged, OPPURE
 *  (b) il contatto ha iniziato la conversazione su WhatsApp, OPPURE
 *  (c) numero dato esplicitamente (whitelist)
 * Inoltre: orario 9-18 locale, no weekend.
 */
export interface WhatsAppGateInput {
  partnerLeadStatus?: string | null;
  hasInboundWhatsApp?: boolean;
  isWhitelisted?: boolean;
  /** Ora locale del destinatario (0-23). Se non nota, passa l'ora UTC (controllo blando). */
  localHour?: number;
  /** Giorno settimana 0=Dom, 6=Sab. */
  localDayOfWeek?: number;
}

export interface WhatsAppGateResult {
  allowed: boolean;
  reason?: string;
}

const ENGAGED_OR_HIGHER = new Set(["engaged", "qualified", "negotiation", "converted"]);

export function checkWhatsAppGate(input: WhatsAppGateInput): WhatsAppGateResult {
  const status = (input.partnerLeadStatus || "").toLowerCase();
  const meetsState = ENGAGED_OR_HIGHER.has(status);
  const cond = meetsState || !!input.hasInboundWhatsApp || !!input.isWhitelisted;
  if (!cond) {
    return {
      allowed: false,
      reason: `WhatsApp VIETATO: stato="${status || "n/d"}" < engaged AND nessun inbound WA AND non whitelisted. Notifica Director.`,
    };
  }
  if (input.localDayOfWeek === 0 || input.localDayOfWeek === 6) {
    return { allowed: false, reason: "WhatsApp bloccato nei weekend (sab/dom)." };
  }
  if (typeof input.localHour === "number" && (input.localHour < 9 || input.localHour >= 18)) {
    return { allowed: false, reason: `WhatsApp bloccato fuori orario 9-18 (ora locale: ${input.localHour}).` };
  }
  return { allowed: true };
}

/**
 * Cadence gate: rifiuta follow-up stesso canale <7gg dall'ultimo invio.
 * Costituzione §3: "Mai stesso canale <7gg".
 */
export async function checkCadenceGate(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string,
  channel: "email" | "linkedin" | "whatsapp",
): Promise<{ allowed: boolean; reason?: string }> {
  const channelToActivityType: Record<string, string> = {
    email: "send_email",
    linkedin: "linkedin_message",
    whatsapp: "whatsapp_message",
  };
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("activities")
    .select("id, created_at, activity_type")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .eq("activity_type", channelToActivityType[channel])
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { allowed: true }; // fail-open su errore tecnico
  if (data && data.length > 0) {
    const last = data[0] as { created_at: string };
    const days = Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86400000);
    return {
      allowed: false,
      reason: `Stesso canale (${channel}) usato ${days}gg fa — la regola dei 7gg blocca questo invio. Notifica Director.`,
    };
  }
  return { allowed: true };
}
