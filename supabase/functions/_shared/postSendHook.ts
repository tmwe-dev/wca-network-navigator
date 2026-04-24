/**
 * postSendHook.ts — Gate functions per validazione pre-invio.
 *
 * Exports:
 *  - checkCadenceGate: verifica regole cadenza invio (§3 Costituzione)
 *  - checkWhatsAppGate: verifica regole WhatsApp (§4 Costituzione)
 *
 * NOTA: runPostSendHook è stato RIMOSSO (dead code, duplicava reminderManager).
 * La pipeline post-invio reale è runPostSendPipeline in postSendPipeline.ts.
 */

// Local alias to avoid pulling SDK types (and version drift) here.
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

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
