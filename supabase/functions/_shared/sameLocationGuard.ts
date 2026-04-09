import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "./sqlEscape.ts";

/**
 * Same-Location Guard: prevents sending multiple commercial communications
 * to different contacts at the same company branch (same company_name + city)
 * within a 7-day window.
 * 
 * Also provides branch coordination info for multi-location companies.
 */

interface GuardResult {
  allowed: boolean;
  reason?: string;
  recentContact?: {
    name: string;
    email: string;
    sent_at: string;
  };
  otherBranches?: Array<{
    city: string;
    country_code: string;
    contact_count: number;
  }>;
}

/**
 * Check if a communication to this contact/company/city is allowed
 * based on the "one contact per branch per 7 days" rule.
 */
export async function checkSameLocationContacts(
  supabase: ReturnType<typeof createClient>,
  companyName: string,
  city: string,
  currentContactEmail: string | null,
  userId: string,
): Promise<GuardResult> {
  if (!companyName) return { allowed: true };

  const safeName = escapeLike(companyName);
  const safeCity = city ? escapeLike(city) : null;
  
  // Find partners with same company name AND same city
  let query = supabase
    .from("partners")
    .select("id, company_name, city, email")
    .ilike("company_name", `%${safeName}%`);
  
  if (safeCity) {
    query = query.ilike("city", `%${safeCity}%`);
  }
  
  const { data: sameLocationPartners } = await query.limit(20);
  
  if (!sameLocationPartners || sameLocationPartners.length <= 1) {
    return { allowed: true };
  }

  // Check if any of these partners received a communication in the last 7 days
  const partnerIds = sameLocationPartners.map(p => p.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: recentComms } = await supabase
    .from("activities")
    .select("source_id, email_subject, sent_at, status")
    .eq("user_id", userId)
    .in("source_id", partnerIds)
    .in("status", ["completed"])
    .gte("sent_at", sevenDaysAgo)
    .order("sent_at", { ascending: false })
    .limit(5);

  if (recentComms && recentComms.length > 0) {
    // Check if the recent comm was to a DIFFERENT contact at the same branch
    const recentPartner = sameLocationPartners.find(p => p.id === recentComms[0].source_id);
    if (recentPartner && recentPartner.email !== currentContactEmail) {
      return {
        allowed: false,
        reason: `Comunicazione già inviata a ${recentPartner.company_name} (${recentPartner.city || "stessa sede"}) il ${recentComms[0].sent_at?.slice(0, 10)}. Regola: una sola comunicazione per sede ogni 7 giorni.`,
        recentContact: {
          name: recentPartner.company_name,
          email: recentPartner.email || "",
          sent_at: recentComms[0].sent_at || "",
        },
      };
    }
  }

  // Also check channel_messages for recent outbound emails
  const { data: recentEmails } = await supabase
    .from("channel_messages")
    .select("partner_id, to_address, created_at")
    .eq("user_id", userId)
    .eq("direction", "outbound")
    .in("partner_id", partnerIds)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentEmails && recentEmails.length > 0) {
    const recentPartner = sameLocationPartners.find(p => p.id === recentEmails[0].partner_id);
    if (recentPartner && recentPartner.email !== currentContactEmail) {
      return {
        allowed: false,
        reason: `Email già inviata a un contatto di ${recentPartner.company_name} nella stessa sede il ${recentEmails[0].created_at?.slice(0, 10)}. Regola: una sola comunicazione per sede.`,
        recentContact: {
          name: recentPartner.company_name,
          email: recentEmails[0].to_address || "",
          sent_at: recentEmails[0].created_at || "",
        },
      };
    }
  }

  return { allowed: true };
}

/**
 * Get all branches (different cities) of the same company.
 * Used to inject branch coordination context into the AI prompt.
 */
export async function getSameCompanyBranches(
  supabase: ReturnType<typeof createClient>,
  companyName: string,
  currentCity: string | null,
  userId: string,
): Promise<Array<{ city: string; country_code: string; contact_count: number }>> {
  if (!companyName) return [];

  const safeName = escapeLike(companyName);
  
  const { data: branches } = await supabase
    .from("partners")
    .select("city, country_code")
    .ilike("company_name", `%${safeName}%`)
    .not("city", "is", null);

  if (!branches || branches.length <= 1) return [];

  // Group by city, exclude current city
  const cityMap = new Map<string, { country_code: string; count: number }>();
  for (const b of branches) {
    if (!b.city) continue;
    const normalizedCity = b.city.trim().toLowerCase();
    if (currentCity && normalizedCity === currentCity.trim().toLowerCase()) continue;
    const existing = cityMap.get(normalizedCity);
    if (existing) {
      existing.count++;
    } else {
      cityMap.set(normalizedCity, { country_code: b.country_code || "??", count: 1 });
    }
  }

  return Array.from(cityMap.entries()).map(([city, info]) => ({
    city,
    country_code: info.country_code,
    contact_count: info.count,
  }));
}

/**
 * Build relationship analysis metrics from interaction history.
 * Returns structured data for the AI prompt.
 */
export interface RelationshipMetrics {
  total_interactions: number;
  total_emails_sent: number;
  total_emails_received: number;
  unanswered_count: number;
  last_contact_date: string | null;
  last_response_date: string | null;
  days_since_last_contact: number;
  relationship_stage: "cold" | "warm" | "active" | "stale" | "ghosted";
  tone_suggestion: string;
}

export async function analyzeRelationshipHistory(
  supabase: ReturnType<typeof createClient>,
  partnerId: string,
  userId: string,
): Promise<{ metrics: RelationshipMetrics; historyText: string }> {
  // Fetch interactions (15 instead of 5)
  const [interRes, actRes, emailRes] = await Promise.all([
    supabase
      .from("interactions")
      .select("interaction_type, subject, notes, interaction_date")
      .eq("partner_id", partnerId)
      .order("interaction_date", { ascending: false })
      .limit(15),
    supabase
      .from("activities")
      .select("email_subject, sent_at, activity_type, status")
      .eq("source_id", partnerId)
      .in("status", ["completed"])
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("channel_messages")
      .select("direction, subject, created_at, from_address")
      .eq("partner_id", partnerId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const interactions = interRes.data || [];
  const activities = actRes.data || [];
  const emails = emailRes.data || [];

  const emailsSent = emails.filter(e => e.direction === "outbound");
  const emailsReceived = emails.filter(e => e.direction === "inbound");
  
  const lastSent = emailsSent[0]?.created_at || activities[0]?.sent_at || null;
  const lastReceived = emailsReceived[0]?.created_at || null;
  
  const daysSinceLastContact = lastSent 
    ? Math.floor((Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Count unanswered: emails sent after last response
  let unanswered = 0;
  if (lastReceived) {
    unanswered = emailsSent.filter(e => new Date(e.created_at) > new Date(lastReceived)).length;
  } else {
    unanswered = emailsSent.length;
  }

  // Determine relationship stage
  let stage: RelationshipMetrics["relationship_stage"] = "cold";
  if (emailsReceived.length > 0 && daysSinceLastContact < 30) stage = "active";
  else if (emailsReceived.length > 0 && daysSinceLastContact >= 30) stage = "stale";
  else if (unanswered >= 3) stage = "ghosted";
  else if (emailsSent.length > 0) stage = "warm";

  // Tone suggestion
  let toneSuggestion = "";
  switch (stage) {
    case "cold": toneSuggestion = "Tono professionale, primo approccio. Presenta chi sei e crea curiosità."; break;
    case "warm": toneSuggestion = "Tono caloroso, referenzia le comunicazioni precedenti. Cerca di ottenere una risposta."; break;
    case "active": toneSuggestion = "Tono colloquiale e diretto. Referenzia le conversazioni recenti. Mantieni il momentum."; break;
    case "stale": toneSuggestion = "Tono di re-engagement. Offri qualcosa di nuovo. Non ripetere messaggi precedenti."; break;
    case "ghosted": toneSuggestion = "CAMBIA APPROCCIO RADICALMENTE. Usa tecnica 'no strategico' o 'last attempt'. Formula: 'Ha rinunciato all'idea di...?'"; break;
  }

  const metrics: RelationshipMetrics = {
    total_interactions: interactions.length,
    total_emails_sent: emailsSent.length + activities.length,
    total_emails_received: emailsReceived.length,
    unanswered_count: unanswered,
    last_contact_date: lastSent,
    last_response_date: lastReceived,
    days_since_last_contact: daysSinceLastContact,
    relationship_stage: stage,
    tone_suggestion: toneSuggestion,
  };

  // Build history text
  const historyParts: string[] = [];
  
  if (interactions.length > 0) {
    historyParts.push("STORIA INTERAZIONI:");
    for (const i of interactions) {
      historyParts.push(`  [${i.interaction_date?.slice(0, 10)}] ${i.interaction_type}: ${i.subject}${i.notes ? ` — ${i.notes.slice(0, 150)}` : ""}`);
    }
  }
  
  if (activities.length > 0) {
    historyParts.push("\nEMAIL GIÀ INVIATE (NON ripetere lo stesso messaggio):");
    for (const a of activities) {
      historyParts.push(`  [${a.sent_at?.slice(0, 10) || "?"}] "${a.email_subject || "N/A"}"`);
    }
  }

  if (emailsReceived.length > 0) {
    historyParts.push("\nRISPOSTE RICEVUTE:");
    for (const e of emailsReceived) {
      historyParts.push(`  [${e.created_at?.slice(0, 10)}] Da: ${e.from_address || "?"} — "${e.subject || "N/A"}"`);
    }
  }

  return { metrics, historyText: historyParts.join("\n") };
}

/**
 * Build the interlocutor type block for the prompt.
 * Differentiates between partner (freight forwarder) and end client.
 */
export function buildInterlocutorTypeBlock(
  sourceType: string,
  partnerType?: string | null,
): string {
  const isPartnerLogistic = sourceType === "partner"; // WCA partners are always logistics partners
  
  if (isPartnerLogistic) {
    return `
--- TIPOLOGIA INTERLOCUTORE: PARTNER LOGISTICO ---
Questo è un potenziale PARTNER COMMERCIALE, non un cliente finale.
È uno spedizioniere/trasportatore come noi — un alleato operativo.

TONO: Collaborativo, da alleanza commerciale. Trasparente e operativo.
CONTENUTO: Parla di sinergie operative, network condivisi, complementarità dei servizi, volume di spedizioni.
PROPOSTA: Integrazione sistemi, accesso tariffe partner, collaborazione strutturata, reciprocità operativa.
NON usare tono da "venditore a cliente" — usa tono da "collega a collega" nel settore.
`;
  }
  
  // End client (contact, prospect, BCA)
  return `
--- TIPOLOGIA INTERLOCUTORE: CLIENTE FINALE ---
Questo è un'azienda che necessita servizi di spedizione/logistica.
NON è del nostro settore — è un potenziale utilizzatore dei nostri servizi.

TONO: Commerciale, orientato ai benefici. Chiaro e accessibile.
CONTENUTO: Parla di semplicità, risparmio, velocità, accesso diretto ai servizi.
PROPOSTA: Apertura account, accesso piattaforma con tariffe privilegiate, semplificazione operativa.
Evidenzia come i nostri sistemi semplifichino tempi e gestione delle spedizioni.
L'obiettivo è portare il contatto ad APRIRE UN ACCOUNT e USARE i nostri sistemi.
`;
}

/**
 * Build branch coordination context for the prompt.
 */
export function buildBranchCoordinationBlock(
  branches: Array<{ city: string; country_code: string; contact_count: number }>,
  currentCity: string | null,
): string {
  if (!branches.length) return "";
  
  const branchList = branches.map(b => `${b.city} (${b.country_code})`).join(", ");
  return `
--- COORDINAMENTO SEDI ---
Questa azienda ha sedi anche a: ${branchList}.
Stai scrivendo alla sede di ${currentCity || "N/D"}.
Se opportuno, puoi menzionare che la comunicazione è stata estesa anche ad altri referenti in sedi diverse della stessa azienda.
Ogni email deve comunque essere PERSONALE e dedicata al singolo destinatario.
`;
}

/**
 * Build relationship analysis block for the prompt.
 */
export function buildRelationshipAnalysisBlock(metrics: RelationshipMetrics): string {
  return `
--- ANALISI RELAZIONE ---
- Comunicazioni inviate: ${metrics.total_emails_sent}
- Risposte ricevute: ${metrics.total_emails_received}
- Senza risposta consecutive: ${metrics.unanswered_count}
- Giorni dall'ultimo contatto: ${metrics.days_since_last_contact}
- Fase relazione: ${metrics.relationship_stage.toUpperCase()}

ISTRUZIONE TONO: ${metrics.tone_suggestion}
${metrics.unanswered_count >= 3 ? `
⚠️ ATTENZIONE: ${metrics.unanswered_count} messaggi senza risposta!
CAMBIA APPROCCIO. Usa una di queste tecniche:
1. "No strategico": "Ha rinunciato all'idea di [obiettivo]?" — provoca risposta correttiva
2. "Last attempt": "Sarà la mia ultima comunicazione su questo tema..."
3. Offri qualcosa di completamente nuovo rispetto ai messaggi precedenti
4. Accorcia drasticamente il messaggio — max 3-4 righe
` : ""}
${metrics.relationship_stage === "active" ? `
✅ Relazione attiva — referenzia le conversazioni recenti, mantieni il momentum.
Usa tono più diretto e colloquiale, come tra professionisti che si conoscono.
` : ""}
`;
}
