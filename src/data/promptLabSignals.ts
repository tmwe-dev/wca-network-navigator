/**
 * promptLabSignals.ts — DAL per segnalazioni automatiche al Prompt Lab.
 *
 * LOVABLE-92: Il feedback loop analizza supervisor_audit_log, decision_log,
 * ai_memory e genera "segnali" che il Prompt Lab mostra come badge/notifica.
 * L'operatore può approvare il suggerimento (avvia miglioramento mirato)
 * o ignorarlo.
 */
import { supabase } from "@/integrations/supabase/client";

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
      .from("supervisor_audit_log" as never)
      .select("action, target_table, target_id, payload, created_at" as never)
      .gte("created_at" as never, sevenDaysAgo as never)
      .or("action.ilike.%error%,action.ilike.%fail%" as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(100);

    if (errorLogs && (errorLogs as unknown[]).length >= 3) {
      const rows = errorLogs as unknown as Array<Record<string, unknown>>;
      // Raggruppa per action
      const groups = new Map<string, number>();
      for (const row of rows) {
        const action = String(row.action ?? "unknown");
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
            evidence: { action, count, period: "7d", sample: rows.slice(0, 3).map((r) => r.payload) },
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
      .from("supervisor_audit_log" as never)
      .select("action" as never)
      .gte("created_at" as never, sevenDaysAgo as never)
      .eq("action" as never, "generate_email" as never);

    const { data: sentEmails } = await supabase
      .from("supervisor_audit_log" as never)
      .select("action" as never)
      .gte("created_at" as never, sevenDaysAgo as never)
      .eq("action" as never, "send_email" as never);

    const generated = (generatedEmails as unknown[] | null)?.length ?? 0;
    const sent = (sentEmails as unknown[] | null)?.length ?? 0;

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
      .from("ai_pending_actions" as never)
      .select("action_type, payload, created_at" as never)
      .gte("created_at" as never, sevenDaysAgo as never)
      .eq("status" as never, "rejected" as never)
      .limit(50);

    if (rejectedActions && (rejectedActions as unknown[]).length >= 3) {
      const rows = rejectedActions as unknown as Array<Record<string, unknown>>;
      const actionTypes = new Map<string, number>();
      for (const row of rows) {
        const t = String(row.action_type ?? "unknown");
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
      .from("ai_memories" as never)
      .select("content, tags, created_at" as never)
      .gte("created_at" as never, sevenDaysAgo as never)
      .contains("tags" as never, ["feedback"] as never)
      .order("created_at" as never, { ascending: false } as never)
      .limit(20);

    if (memories && (memories as unknown[]).length > 0) {
      const rows = memories as unknown as Array<Record<string, unknown>>;
      signals.push({
        id: `feedback-memory-${Date.now()}`,
        type: "user_feedback",
        severity: rows.length >= 5 ? "warning" : "info",
        title: `${rows.length} feedback utente recenti`,
        description: `Trovati ${rows.length} feedback salvati come memoria negli ultimi 7 giorni. Questi indicano correzioni o preferenze dell'operatore che dovrebbero riflettersi nei prompt.`,
        affected_blocks: [],
        evidence: { count: rows.length, samples: rows.slice(0, 5).map((r) => String(r.content ?? "").slice(0, 200)) },
        suggested_action: "Copia i feedback nel campo 'Materiale di riferimento' del Migliora tutto per incorporarli nei prompt.",
        status: "new",
        created_at: now.toISOString(),
      });
    }
  } catch { /* skip */ }

  // LOVABLE-93: coerenza Prompt Lab multi-dominio — detect domain misclassification patterns
  try {
    const { data: corrections } = await supabase
      .from("ai_memory" as never)
      .select("tags" as never)
      .gte("created_at" as never, sevenDaysAgo as never)
      .eq("user_id" as never, userId as never)
      .contains("tags" as never, ["correzione_utente"] as never)
      .limit(50);

    if (corrections && (corrections as unknown[]).length >= 3) {
      const rows = corrections as unknown as Array<Record<string, unknown>>;
      // Raggruppa per domain tag
      const domainChanges = new Map<string, number>();
      for (const row of rows) {
        const tags = (row.tags as string[] | undefined) || [];
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
export async function getRecentSignalCount(userId: string): Promise<number> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Count errori + rejected nelle ultime 7 giorni come proxy per segnalazioni attive
    const { count: errorCount } = await supabase
      .from("supervisor_audit_log" as never)
      .select("id" as never, { count: "exact", head: true })
      .gte("created_at" as never, sevenDaysAgo as never)
      .or("action.ilike.%error%,action.ilike.%fail%" as never);

    const { count: rejectedCount } = await supabase
      .from("ai_pending_actions" as never)
      .select("id" as never, { count: "exact", head: true })
      .gte("created_at" as never, sevenDaysAgo as never)
      .eq("status" as never, "rejected" as never);

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
