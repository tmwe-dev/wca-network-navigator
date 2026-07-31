/**
 * promptLabSignals.ts — DAL per segnalazioni automatiche al Prompt Lab.
 *
 * LOVABLE-92: Il feedback loop analizza supervisor_audit_log, decision_log,
 * ai_memory e genera "segnali" che il Prompt Lab mostra come badge/notifica.
 * L'operatore può approvare il suggerimento (avvia miglioramento mirato)
 * o ignorarlo.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Mapping colonne reali di `supervisor_audit_log`.
 * La tabella NON ha una colonna `action`: le scritture (vedi
 * `src/data/supervisorAuditLog.ts` e i chiamanti di `logAuditEntry`)
 * salvano il tipo di azione in `action_category` e la descrizione
 * leggibile in `action_detail`. Le query storiche su `action`
 * fallivano silenziosamente (try/catch) e non generavano mai segnali.
 */
export const EMAIL_GENERATED_CATEGORY = "email_drafted";
export const EMAIL_SENT_CATEGORY = "email_sent";
/** Errori/fallimenti: possono comparire sia nella categoria sia nel dettaglio. */
export const ERROR_ACTION_FILTER =
  "action_category.ilike.%error%,action_category.ilike.%fail%,action_detail.ilike.%error%,action_detail.ilike.%fail%";

export interface PromptLabSignal {
  id: string;
  type: "error_pattern" | "low_acceptance" | "doctrine_violation" | "performance_drop" | "user_feedback" | "domain_misclassification"; // LOVABLE-93
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  /** Blocchi/prompt coinvolti (IDs) */
  affected_blocks: string[];
  /** Dati grezzi di supporto (esempi, conteggi, etc.) */
  evidence: Record<string, unknown>;
  /** Suggerimento di azione */
  suggested_action: string;
  status: "new" | "acknowledged" | "applied" | "dismissed";
  created_at: string;
}

/**
 * Analizza i log recenti e genera segnalazioni.
 * Chiamato periodicamente o on-demand dal Prompt Lab.
 */
export async function analyzeAndGenerateSignals(userId: string): Promise<PromptLabSignal[]> {
  const signals: PromptLabSignal[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Pattern errori ricorrenti nelle azioni AI
  try {
    const { data: errorLogs } = await supabase
      .from("supervisor_audit_log")
      .select("action_category, action_detail, target_type, target_id, metadata, created_at")
      .gte("created_at", sevenDaysAgo)
      .or(ERROR_ACTION_FILTER)
      .order("created_at", { ascending: false })
      .limit(100);

    if (errorLogs && errorLogs.length >= 3) {
      const rows = errorLogs;
      // Raggruppa per categoria di azione
      const groups = new Map<string, number>();
      for (const row of rows) {
        const action = row.action_category || "unknown";
        groups.set(action, (groups.get(action) ?? 0) + 1);
      }
      for (const [action, count] of groups) {
        if (count >= 3) {
          signals.push({
            id: `err-${action}-${Date.now()}`,
            type: "error_pattern",
            severity: count >= 10 ? "critical" : "warning",
            title: `Errore ricorrente: ${action}`,
            description: `L'azione "${action}" ha generato ${count} errori negli ultimi 7 giorni. Potrebbe indicare un prompt mal calibrato o una regola mancante nella dottrina.`,
            affected_blocks: [],
            evidence: { action, count, period: "7d", sample: rows.slice(0, 3).map((r) => r.metadata) },
            suggested_action: `Verifica il prompt collegato a "${action}" e aggiungi guard-rail o vincoli mancanti.`,
            status: "new",
            created_at: now.toISOString(),
          });
        }
      }
    }
  } catch { /* skip */ }

  // 2) Tasso di accettazione email basso (molte email generate ma poche inviate)
  try {
    const { data: generatedEmails } = await supabase
      .from("supervisor_audit_log")
      .select("action_category")
      .gte("created_at", sevenDaysAgo)
      .eq("action_category", EMAIL_GENERATED_CATEGORY);

    const { data: sentEmails } = await supabase
      .from("supervisor_audit_log")
      .select("action_category")
      .gte("created_at", sevenDaysAgo)
      .eq("action_category", EMAIL_SENT_CATEGORY);

    const generated = generatedEmails?.length ?? 0;
    const sent = sentEmails?.length ?? 0;

    if (generated >= 5 && sent > 0) {
      const ratio = sent / generated;
      if (ratio < 0.3) {
        signals.push({
          id: `acceptance-email-${Date.now()}`,
          type: "low_acceptance",
          severity: ratio < 0.1 ? "critical" : "warning",
          title: "Basso tasso accettazione email",
          description: `Solo ${Math.round(ratio * 100)}% delle email generate sono state inviate (${sent}/${generated} negli ultimi 7gg). L'operatore scarta o riscrive la maggior parte.`,
          affected_blocks: ["Email Forge", "Email Types"],
          evidence: { generated, sent, ratio: Math.round(ratio * 100), period: "7d" },
          suggested_action: "Migliora i prompt Email Forge e Email Types. Considera di aggiungere materiale di riferimento con esempi di email approvate.",
          status: "new",
          created_at: now.toISOString(),
        });
      }
    }
  } catch { /* skip */ }

  // 3) Decision Engine: molte azioni rifiutate (rejected)
  try {
    const { data: rejectedActions } = await supabase
      .from("ai_pending_actions")
      .select("action_type, action_payload, created_at")
      .gte("created_at", sevenDaysAgo)
      .eq("status", "rejected")
      .limit(50);

    if (rejectedActions && rejectedActions.length >= 3) {
      const rows = rejectedActions;
      const actionTypes = new Map<string, number>();
      for (const row of rows) {
        const t = row.action_type || "unknown";
        actionTypes.set(t, (actionTypes.get(t) ?? 0) + 1);
      }
      for (const [actionType, count] of actionTypes) {
        if (count >= 2) {
          signals.push({
            id: `rejected-${actionType}-${Date.now()}`,
            type: "doctrine_violation",
            severity: count >= 5 ? "critical" : "warning",
            title: `Azioni rifiutate: ${actionType}`,
            description: `${count} azioni di tipo "${actionType}" sono state rifiutate dall'operatore. Il sistema sta proponendo azioni non desiderate.`,
            affected_blocks: ["Decision Engine", "Agent Prompts"],
            evidence: { actionType, count, period: "7d" },
            suggested_action: `Rivedi le regole del Decision Engine per "${actionType}" e aggiorna i guard-rail nei prompt agente.`,
            status: "new",
            created_at: now.toISOString(),
          });
        }
      }
    }
  } catch { /* skip */ }

  // 4) Memorie di apprendimento (feedback dall'utente salvati come memory)
  try {
    const { data: memories } = await supabase
      .from("ai_memory")
      .select("content, tags, created_at")
      .gte("created_at", sevenDaysAgo)
      .contains("tags", ["feedback"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (memories && memories.length > 0) {
      const rows = memories;
      signals.push({
        id: `feedback-memory-${Date.now()}`,
        type: "user_feedback",
        severity: rows.length >= 5 ? "warning" : "info",
        title: `${rows.length} feedback utente recenti`,
        description: `Trovati ${rows.length} feedback salvati come memoria negli ultimi 7 giorni. Questi indicano correzioni o preferenze dell'operatore che dovrebbero riflettersi nei prompt.`,
        affected_blocks: [],
        evidence: { count: rows.length, samples: rows.slice(0, 5).map((r) => (r.content ?? "").slice(0, 200)) },
        suggested_action: "Copia i feedback nel campo 'Materiale di riferimento' del Migliora tutto per incorporarli nei prompt.",
        status: "new",
        created_at: now.toISOString(),
      });
    }
  } catch { /* skip */ }

  // 5) Performance drop: confronta volumi email inviate/generate vs periodo precedente
  try {
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Volume ultime 7 gg
    const { count: recentGenerated } = await supabase
      .from("supervisor_audit_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo)
      .eq("action_category", EMAIL_GENERATED_CATEGORY);

    // Volume 7 gg precedenti (14-7 giorni fa)
    const { count: previousGenerated } = await supabase
      .from("supervisor_audit_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fourteenDaysAgo)
      .lt("created_at", sevenDaysAgo)
      .eq("action_category", EMAIL_GENERATED_CATEGORY);

    const recent = recentGenerated ?? 0;
    const previous = previousGenerated ?? 0;

    // Segnala solo se c'era attività precedente e c'è un calo significativo (>40%)
    if (previous >= 5 && recent < previous * 0.6) {
      const dropPct = Math.round((1 - recent / previous) * 100);
      signals.push({
        id: `perf-drop-email-${Date.now()}`,
        type: "performance_drop",
        severity: dropPct >= 70 ? "critical" : "warning",
        title: `Calo utilizzo email: -${dropPct}%`,
        description: `Le email generate sono calate del ${dropPct}% rispetto alla settimana precedente (da ${previous} a ${recent}). Potrebbe indicare problemi nei prompt, bassa qualità percepita o cambio di strategia operativa.`,
        affected_blocks: ["Email Forge", "Email Types", "System Prompt"],
        evidence: { recentCount: recent, previousCount: previous, dropPercent: dropPct, period: "7d vs 7d" },
        suggested_action: "Verifica se i prompt email sono stati modificati di recente. Controlla il tasso di accettazione e i feedback utente.",
        status: "new",
        created_at: now.toISOString(),
      });
    }
  } catch { /* skip */ }

  // LOVABLE-93: coerenza Prompt Lab multi-dominio — detect domain misclassification patterns
  try {
    const { data: corrections } = await supabase
      .from("ai_memory")
      .select("tags")
      .gte("created_at", sevenDaysAgo)
      .eq("user_id", userId)
      .contains("tags", ["correzione_utente"])
      .limit(50);

    if (corrections && corrections.length >= 3) {
      const rows = corrections;
      // Raggruppa per domain tag
      const domainChanges = new Map<string, number>();
      for (const row of rows) {
        const tags = row.tags ?? [];
        const domainTag = tags.find((t) => t.startsWith("domain:"));
        if (domainTag) {
          const domain = domainTag.replace("domain:", "");
          // Conta se c'è una correzione nel dominio
          const hasDomainCorrection = tags.some((t) => /da_.*(operative|administrative|support)/i.test(t) || /a_.*(operative|administrative|support)/i.test(t));
          if (hasDomainCorrection) {
            domainChanges.set(domain, (domainChanges.get(domain) ?? 0) + 1);
          }
        }
      }
      for (const [domain, count] of domainChanges) {
        if (count >= 2) {
          signals.push({
            id: `domain-misclass-${domain}-${Date.now()}`,
            type: "domain_misclassification",
            severity: count >= 5 ? "warning" : "info",
            title: `Frequenti reclassificazioni dominio: ${domain}`,
            description: `Nel dominio "${domain}" sono state corrette ${count} classificazioni negli ultimi 7 giorni. Il sistema non sta classificando correttamente email per questo dominio.`,
            affected_blocks: ["domain_routing", "email-classifier"],
            evidence: { domain, correctionCount: count, period: "7d" },
            suggested_action: `Migliora il prompt email-classifier e la KB domain_routing per il dominio "${domain}". Considera di aggiungere esempi di email caratteristiche.`,
            status: "new",
            created_at: now.toISOString(),
          });
        }
      }
    }
  } catch { /* skip */ }

  return signals;
}

/**
 * Recupera segnalazioni precedentemente generate (per storico/badge count).
 * Usa una query sugli audit log con action = 'prompt_lab_signal'.
 */
export async function getRecentSignalCount(_userId: string): Promise<number> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Count errori + rejected nelle ultime 7 giorni come proxy per segnalazioni attive
    const { count: errorCount } = await supabase
      .from("supervisor_audit_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo)
      .or(ERROR_ACTION_FILTER);

    const { count: rejectedCount } = await supabase
      .from("ai_pending_actions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo)
      .eq("status", "rejected");

    const total = (errorCount ?? 0) + (rejectedCount ?? 0);
    // Ritorna un contatore proporzionale (non il numero grezzo)
    if (total >= 10) return 3; // critico
    if (total >= 5) return 2;  // warning
    if (total >= 1) return 1;  // info
    return 0;
  } catch {
    return 0;
  }
}
