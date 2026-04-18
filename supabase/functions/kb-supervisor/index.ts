/**
 * kb-supervisor — Audit della Knowledge Base e dei Prompt.
 * Verifica struttura (Livello 1), coerenza (Livello 2), allineamento strategico (Livello 3).
 * NON modifica nulla: segnala, propone, registra come attività per review utente.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

interface AuditResult {
  level: "structural" | "coherence" | "strategic";
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  description: string;
  location: string;
  impact: string;
  fix_proposal: string;
}

interface KbEntry {
  id: string;
  title: string | null;
  category: string | null;
  tags: string[] | null;
  priority: number | null;
  is_active: boolean | null;
  content: string | null;
}

interface PlaybookRow {
  id: string;
  name: string | null;
  trigger_conditions: Record<string, unknown> | null;
  kb_tags: string[] | null;
}

serve(async (req: Request) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body.user_id;
    const auditLevel: string = body.audit_level || "all";

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const results: AuditResult[] = [];

    // ════════════════════════════════════════
    // LEVEL 1: STRUCTURAL VALIDATION
    // ════════════════════════════════════════
    if (auditLevel === "all" || auditLevel === "structural") {
      const { data: allKB } = await supabase
        .from("kb_entries")
        .select("id, title, category, tags, priority, is_active, content")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq("is_active", true);

      const kbEntries: KbEntry[] = (allKB as KbEntry[]) || [];

      // 1c. Required tags (from commercial doctrine)
      const requiredTags = [
        "commercial_doctrine", "holding_pattern", "relationship_progression",
        "tone_modulation", "exit_rules", "multichannel", "commercial_learning",
        "system_core", "cold_outreach", "follow_up", "closing",
      ];
      for (const tag of requiredTags) {
        const hasEntry = kbEntries.some((e) => (e.tags || []).includes(tag));
        if (!hasEntry) {
          results.push({
            level: "structural",
            severity: tag.startsWith("commercial_") || tag === "system_core" ? "critical" : "high",
            category: "orphan_tag",
            description: `Tag "${tag}" richiesto dal sistema ma ZERO KB entries lo usano`,
            location: "kb_entries table",
            impact: "L'AI non riceve dottrina quando il contesto richiede questo tag",
            fix_proposal: `Creare KB entry con tag "${tag}" o aggiungere il tag a entry esistenti`,
          });
        }
      }

      // 1d. Required categories
      const requiredCategories = [
        "system_doctrine", "sales_doctrine", "country_culture", "communication_pattern",
      ];
      for (const cat of requiredCategories) {
        const hasEntry = kbEntries.some((e) => e.category === cat);
        if (!hasEntry) {
          results.push({
            level: "structural",
            severity: cat === "system_doctrine" ? "critical" : "high",
            category: "empty_category",
            description: `Categoria "${cat}" vuota — nessuna KB entry attiva`,
            location: "kb_entries table",
            impact: "contextTagExtractor genera questa categoria ma non trova contenuti",
            fix_proposal: `Creare almeno 1 KB entry per categoria "${cat}"`,
          });
        }
      }

      // 1e. Commercial states with doctrine (tassonomia canonica DB)
      const commercialStates = [
        "new", "contacted", "in_progress",
        "negotiation", "converted", "lost",
      ];
      for (const state of commercialStates) {
        const hasEntry = kbEntries.some((e) =>
          (e.tags || []).includes(state) ||
          (e.content || "").toLowerCase().includes(state)
        );
        if (!hasEntry) {
          results.push({
            level: "structural",
            severity: state === "holding" || state === "engaged" ? "critical" : "medium",
            category: "state_without_doctrine",
            description: `Stato commerciale "${state}" senza dottrina KB dedicata`,
            location: "kb_entries table",
            impact: "L'AI non ha guida specifica per contatti in questo stato",
            fix_proposal: `Creare KB entry con istruzioni per gestire contatti in stato "${state}"`,
          });
        }
      }

      // 1f. Duplicate titles
      const titleMap = new Map<string, KbEntry[]>();
      kbEntries.forEach((e) => {
        const key = (e.title || "").toLowerCase().trim();
        if (!key) return;
        if (!titleMap.has(key)) titleMap.set(key, []);
        titleMap.get(key)!.push(e);
      });
      titleMap.forEach((entries, title) => {
        if (entries.length > 1) {
          results.push({
            level: "structural",
            severity: "medium",
            category: "duplicate_entry",
            description: `${entries.length} KB entries con titolo simile: "${title}"`,
            location: `IDs: ${entries.map((e) => e.id).join(", ")}`,
            impact: "Spreco di token nel contesto + possibili contraddizioni",
            fix_proposal: "Unire le entry mantenendo il contenuto migliore",
          });
        }
      });

      // 1g. Untagged entries
      kbEntries.forEach((e) => {
        if (!e.tags || e.tags.length === 0) {
          results.push({
            level: "structural",
            severity: "medium",
            category: "untagged_entry",
            description: `KB entry senza tag: "${e.title}"`,
            location: `ID: ${e.id}`,
            impact: "Entry raggiungibile solo via RAG o priority fallback, mai via tag-based L1",
            fix_proposal: "Aggiungere tag appropriati",
          });
        }
      });
    }

    // ════════════════════════════════════════
    // LEVEL 2: COHERENCE CHECK
    // ════════════════════════════════════════
    if (auditLevel === "all" || auditLevel === "coherence") {
      const { data: kbRows } = await supabase
        .from("kb_entries")
        .select("id, title, content, tags, category")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq("is_active", true);

      const kbEntries: KbEntry[] = (kbRows as KbEntry[]) || [];

      const oldTaxonomy = ["cold", "warm", "active", "stale", "ghosted"];
      kbEntries.forEach((e) => {
        const content = (e.content || "").toLowerCase();
        const hasOldTerms = oldTaxonomy.filter((t) => content.includes(`"${t}"`)).length > 0;
        if (hasOldTerms && !content.includes("mapping") && !content.includes("compatibilità")) {
          results.push({
            level: "coherence",
            severity: "high",
            category: "taxonomy_mismatch",
            description: `KB entry "${e.title}" usa tassonomia vecchia (cold/warm/active/stale/ghosted)`,
            location: `ID: ${e.id}`,
            impact: "L'AI potrebbe usare vocabolario incoerente con la dottrina",
            fix_proposal: "Aggiornare alla tassonomia unificata (new/holding/engaged/qualified/etc.)",
          });
        }
      });

      // Playbook stage alignment
      const { data: playbookRows } = await supabase
        .from("commercial_playbooks")
        .select("id, name, trigger_conditions, kb_tags")
        .eq("user_id", userId)
        .eq("is_active", true);

      const playbooks: PlaybookRow[] = (playbookRows as PlaybookRow[]) || [];
      playbooks.forEach((p) => {
        const triggers = (p.trigger_conditions || {}) as Record<string, unknown>;
        if (!triggers.lead_status && !triggers.commercial_state) {
          results.push({
            level: "coherence",
            severity: "medium",
            category: "playbook_no_stage",
            description: `Playbook "${p.name}" senza trigger di stato commerciale`,
            location: `ID: ${p.id}`,
            impact: "Il playbook non si attiva in base alla fase della relazione",
            fix_proposal: "Aggiungere trigger_conditions.commercial_state o lead_status",
          });
        }
      });
    }

    // ════════════════════════════════════════
    // LEVEL 3: STRATEGIC ALIGNMENT
    // ════════════════════════════════════════
    if (auditLevel === "all" || auditLevel === "strategic") {
      const { data: kbRows } = await supabase
        .from("kb_entries")
        .select("id, title, content, tags, category, priority")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq("is_active", true);

      const kbEntries: KbEntry[] = (kbRows as KbEntry[]) || [];

      const strategicKeywords: Record<string, string[]> = {
        acquisition: ["contatto", "outreach", "cold", "primo", "prospecting"],
        holding: ["holding", "circuito", "attesa", "follow-up", "nurturing"],
        conversion: ["conversione", "chiusura", "closing", "negoziazione", "proposta"],
        exit_management: ["archiviazione", "uscita", "blacklist", "riattivazione"],
        retention: ["cliente", "mantenimento", "onboarding", "fidelizzazione"],
        skill: ["tecnica", "obiezione", "tono", "voss", "filtro"],
      };

      kbEntries.forEach((e) => {
        const text = `${(e.title || "").toLowerCase()} ${(e.content || "").toLowerCase()}`;
        let strategicScore = 0;
        for (const keywords of Object.values(strategicKeywords)) {
          const matches = keywords.filter((k) => text.includes(k));
          strategicScore += matches.length;
        }
        if (strategicScore === 0 && e.category !== "system_doctrine") {
          results.push({
            level: "strategic",
            severity: "low",
            category: "low_strategic_alignment",
            description: `KB entry "${e.title}" non sembra servire il ciclo commerciale`,
            location: `ID: ${e.id}, category: ${e.category}`,
            impact: "Occupa spazio nel contesto senza contribuire all'obiettivo",
            fix_proposal: "Valutare ristrutturazione per allineare al ciclo, o declassare priority",
          });
        }
      });
    }

    // ════════════════════════════════════════
    // SUMMARY + ACTIVITY
    // ════════════════════════════════════════
    const summary = {
      total_issues: results.length,
      critical: results.filter((r) => r.severity === "critical").length,
      high: results.filter((r) => r.severity === "high").length,
      medium: results.filter((r) => r.severity === "medium").length,
      low: results.filter((r) => r.severity === "low").length,
      by_level: {
        structural: results.filter((r) => r.level === "structural").length,
        coherence: results.filter((r) => r.level === "coherence").length,
        strategic: results.filter((r) => r.level === "strategic").length,
      },
    };

    // Save audit report as activity (best-effort)
    try {
      await supabase.from("activities").insert({
        user_id: userId,
        title: `KB Supervisor Audit — ${summary.total_issues} issues (${summary.critical} critiche)`,
        description: JSON.stringify({ summary, results }, null, 2),
        activity_type: "kb_audit",
        source_type: "system",
        source_id: crypto.randomUUID(),
        priority: summary.critical > 0 ? "high" : "medium",
        status: "pending",
      });
    } catch (actErr) {
      console.warn("[kb-supervisor] Could not save activity:", actErr);
    }

    return new Response(JSON.stringify({ summary, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[kb-supervisor] error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
