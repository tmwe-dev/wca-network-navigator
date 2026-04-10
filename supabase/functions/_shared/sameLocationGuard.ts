import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Same-Location Guard — simplified.
 * Uses partner_id to find colleagues (partner_contacts) instead of fuzzy name search.
 * Rule: one commercial communication per partner (same branch/city) every 7 days.
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
 * Check if we already contacted another person at the same partner in the last 7 days.
 * Uses partner_id (not fuzzy company name) — contacts are already linked.
 */
export async function checkSameLocationContacts(
  supabase: ReturnType<typeof createClient>,
  partnerId: string,
  currentContactEmail: string | null,
  userId: string,
): Promise<GuardResult> {
  if (!partnerId) return { allowed: true };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Check recent outbound communications to this partner
  const [actRes, emailRes] = await Promise.all([
    supabase
      .from("activities")
      .select("email_subject, sent_at, selected_contact_id")
      .eq("source_id", partnerId)
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("sent_at", sevenDaysAgo)
      .order("sent_at", { ascending: false })
      .limit(5),
    supabase
      .from("channel_messages")
      .select("to_address, created_at")
      .eq("partner_id", partnerId)
      .eq("user_id", userId)
      .eq("direction", "outbound")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Check activities — was a different contact at this partner emailed recently?
  const recentActs = actRes.data || [];
  if (recentActs.length > 0 && currentContactEmail) {
    // Look up the contact_id for the current email to compare
    const { data: currentContactRow } = await supabase
      .from("partner_contacts")
      .select("id")
      .eq("partner_id", partnerId)
      .ilike("email", currentContactEmail)
      .limit(1)
      .maybeSingle();
    const currentContactId = currentContactRow?.id || null;

    // Find if a DIFFERENT contact was emailed (same contact = follow-up = ok)
    const sentToOther = recentActs.find(a => {
      if (!a.selected_contact_id) return false; // no contact tracked, skip
      if (currentContactId && a.selected_contact_id === currentContactId) return false; // same person
      return true; // different person at same partner
    });

    if (sentToOther) {
      // Fetch the name/email of the recently contacted person
      const { data: recentContactRow } = await supabase
        .from("partner_contacts")
        .select("name, email")
        .eq("id", sentToOther.selected_contact_id)
        .maybeSingle();

      return {
        allowed: false,
        reason: `Comunicazione già inviata a ${recentContactRow?.name || "un altro contatto"} di questo partner il ${sentToOther.sent_at?.slice(0, 10)}. Regola: una sola comunicazione per sede ogni 7 giorni.`,
        recentContact: {
          name: recentContactRow?.name || "",
          email: recentContactRow?.email || "",
          sent_at: sentToOther.sent_at || "",
        },
      };
    }
  }

  // Check channel_messages — was an outbound email sent to this partner?
  const recentEmails = emailRes.data || [];
  if (recentEmails.length > 0) {
    const sent = recentEmails[0];
    // Allow if it's the same recipient (follow-up to same person is ok)
    if (currentContactEmail && sent.to_address === currentContactEmail) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Email già inviata a ${sent.to_address || "un contatto"} di questo partner il ${sent.created_at?.slice(0, 10)}.`,
      recentContact: {
        name: "",
        email: sent.to_address || "",
        sent_at: sent.created_at || "",
      },
    };
  }

  return { allowed: true };
}

/**
 * Get other branches (different cities) of the same company using company_name from the partner record.
 */
export async function getSameCompanyBranches(
  supabase: ReturnType<typeof createClient>,
  partnerId: string,
): Promise<Array<{ city: string; country_code: string; contact_count: number }>> {
  // Get partner's company_name and city
  const { data: partner } = await supabase
    .from("partners")
    .select("company_name, city")
    .eq("id", partnerId)
    .single();

  if (!partner?.company_name) return [];

  // Find other partners with same company_name but different city
  const { data: branches } = await supabase
    .from("partners")
    .select("id, city, country_code")
    .eq("company_name", partner.company_name) // exact match, not fuzzy
    .neq("id", partnerId);

  if (!branches || branches.length === 0) return [];

  const cityMap = new Map<string, { country_code: string; count: number }>();
  for (const b of branches) {
    if (!b.city) continue;
    const key = b.city.toLowerCase().trim();
    const existing = cityMap.get(key);
    if (existing) existing.count++;
    else cityMap.set(key, { country_code: b.country_code || "??", count: 1 });
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

  let unanswered = 0;
  if (lastReceived) {
    unanswered = emailsSent.filter(e => new Date(e.created_at) > new Date(lastReceived)).length;
  } else {
    unanswered = emailsSent.length;
  }

  let stage: RelationshipMetrics["relationship_stage"] = "cold";
  if (emailsReceived.length > 0 && daysSinceLastContact < 30) stage = "active";
  else if (emailsReceived.length > 0 && daysSinceLastContact >= 30) stage = "stale";
  else if (unanswered >= 3) stage = "ghosted";
  else if (emailsSent.length > 0) stage = "warm";

  // No hardcoded tone — let the AI decide based on stage + context
  const toneSuggestion = stage;

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
export function buildInterlocutorTypeBlock(sourceType: string): string {
  // Pass only the type — let the AI decide tone and strategy from KB + context
  return `\n--- TIPOLOGIA INTERLOCUTORE: ${sourceType === "partner" ? "PARTNER LOGISTICO (spedizioniere/trasportatore)" : "CLIENTE FINALE (azienda che necessita servizi logistici)"} ---\n`;
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
  // Data only — AI decides how/whether to mention branches
  return `\n--- SEDI AZIENDALI ---\nSede attuale: ${currentCity || "N/D"}\nAltre sedi: ${branchList}\n`;
}

/**
 * Build relationship analysis block for the prompt.
 */
export function buildRelationshipAnalysisBlock(metrics: RelationshipMetrics): string {
  // Data only — AI decides strategy based on these metrics + KB techniques
  return `
--- ANALISI RELAZIONE ---
- Comunicazioni inviate: ${metrics.total_emails_sent}
- Risposte ricevute: ${metrics.total_emails_received}
- Senza risposta consecutive: ${metrics.unanswered_count}
- Giorni dall'ultimo contatto: ${metrics.days_since_last_contact}
- Fase relazione: ${metrics.relationship_stage.toUpperCase()}
`;
}
