import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { readUnifiedEnrichment, formatEnrichmentForPrompt } from "../_shared/enrichmentAdapter.ts";
import { journalistReview } from "../_shared/journalistReviewLayer.ts";
import { loadOptimusSettings } from "../_shared/journalistSelector.ts";
import { getMaxTokensForFunction } from "../_shared/tokenLogger.ts";
import type { JournalistReviewOutput } from "../_shared/journalistTypes.ts";
import { buildEmailContract, validateEmailContract, type ResolvedEmailType } from "../_shared/emailContract.ts";
import { detectEmailType } from "../_shared/emailTypeDetector.ts";

interface KbEntry { title: string; content: string; category: string; chapter: string; tags: string[]; }

async function fetchKbEntriesForImprove(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  emailTypeId: string | null,
  isFollowUp: boolean,
  extraCategories?: string[],
): Promise<{ text: string; sections: string[] }> {
  const categories: string[] = ["regole_sistema", "filosofia", "struttura_email", "hook"];
  if (emailTypeId === "follow_up" || isFollowUp) categories.push("followup", "chris_voss", "obiezioni");
  if (emailTypeId === "primo_contatto") categories.push("cold_outreach");
  categories.push("negoziazione", "tono", "frasi_modello");
  // FIX 3b-I: accept email_type_kb_categories (allineato con generate-email)
  if (extraCategories?.length) categories.push(...extraCategories);
  const { data: entries } = await supabase
    .from("kb_entries").select("title, content, category, chapter, tags")
    .eq("user_id", userId).eq("is_active", true)
    .in("category", [...new Set(categories)])
    .order("priority", { ascending: false }).order("sort_order").limit(15);
  if (!entries || entries.length === 0) return { text: "", sections: [] };
  const sections = [...new Set((entries as KbEntry[]).map((e) => e.category))];
  const text = (entries as KbEntry[]).map((e) => `### ${e.title} [${e.chapter}]\n${e.content}`).join("\n\n---\n\n");
  return { text, sections };
}

interface PartnerCtx {
  company_name: string | null;
  company_alias: string | null;
  country_name: string | null;
  city: string | null;
  lead_status: string | null;
}
interface ContactCtx {
  name: string | null;
  contact_alias: string | null;
  title: string | null;
}

async function loadPartnerContact(
  supabase: ReturnType<typeof createClient>,
  partnerId: string | null,
  contactId: string | null,
): Promise<{ partner: PartnerCtx | null; contact: ContactCtx | null }> {
  let partner: PartnerCtx | null = null;
  let contact: ContactCtx | null = null;
  if (partnerId) {
    const { data } = await supabase.from("partners")
      .select("company_name, company_alias, country_name, city, lead_status")
      .eq("id", partnerId).maybeSingle();
    if (data) partner = data as PartnerCtx;
  }
  if (contactId) {
    const { data } = await supabase.from("partner_contacts")
      .select("name, contact_alias, title")
      .eq("id", contactId).maybeSingle();
    if (data) contact = data as ContactCtx;
  }
  return { partner, contact };
}

async function loadHistoryStats(
  supabase: ReturnType<typeof createClient>,
  partnerId: string | null,
): Promise<{ touchCount: number; daysSince: number | null; lastChannel: string | null }> {
  if (!partnerId) return { touchCount: 0, daysSince: null, lastChannel: null };
  const { data } = await supabase.from("activities")
    .select("activity_type, sent_at, created_at")
    .eq("partner_id", partnerId)
    .in("activity_type", ["email", "whatsapp", "linkedin"])
    .order("created_at", { ascending: false }).limit(20);
  const rows = (data || []) as Array<{ activity_type: string; sent_at: string | null; created_at: string }>;
  if (!rows.length) return { touchCount: 0, daysSince: null, lastChannel: null };
  const lastTs = rows[0].sent_at || rows[0].created_at;
  const daysSince = lastTs ? Math.floor((Date.now() - new Date(lastTs).getTime()) / 86400000) : null;
  return { touchCount: rows.length, daysSince, lastChannel: rows[0].activity_type };
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // FIX 12: Rate limit (allineato con generate-email)
    const rl = checkRateLimit(`improve-email:${userId}`, { maxTokens: 10, refillRate: 0.2 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // LOVABLE-93: global pause check
    const { data: pauseSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_automations_paused")
      .eq("user_id", userId)
      .maybeSingle();

    if (pauseSettings?.value === "true") {
      return new Response(JSON.stringify({ error: "AI automations are paused" }), {
        status: 503, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const {
      subject, html_body, recipient_count, recipient_countries,
      oracle_tone, use_kb,
      email_type_id, email_type_prompt, email_type_structure,
      email_type_kb_categories,
      custom_goal, partner_id, contact_id,
      learned_patterns,
      quality: rawQuality,
    } = await req.json();
    // FIX 3b-G: accept quality param (allineato con generate-email)
    const quality: "fast" | "standard" | "premium" =
      (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard");
    if (!html_body) throw new Error("html_body is required");

    // ── LOVABLE-110: learned_patterns — client-side o fallback server-side ──
    let effectiveLearnedPatterns: string = learned_patterns || "";
    if (!effectiveLearnedPatterns) {
      try {
        const { data: lpRows } = await supabase
          .from("suggested_improvements")
          .select("suggestion_type, priority, title, content")
          .eq("user_id", userId)
          .in("status", ["approved", "applied"])
          .order("priority", { ascending: false })
          .limit(30);
        if (lpRows && lpRows.length > 0) {
          effectiveLearnedPatterns = (lpRows as Array<{ suggestion_type: string; priority: string; title: string; content: string }>)
            .map((r) => `[${r.suggestion_type}|${r.priority}] ${r.title}: ${r.content.substring(0, 200)}`)
            .join("\n");
        }
      } catch (lpErr) {
        console.warn("[improve-email] learned_patterns fallback failed:", lpErr instanceof Error ? lpErr.message : lpErr);
      }
    }

    // ── LOVABLE-81/82: Contratto + detector tipo (non bloccante; improve può funzionare anche su draft puri) ──
    let typeResolutionImprove: ResolvedEmailType | null = null;
    const contractWarningsImprove: string[] = [];
    if (partner_id) {
      try {
        const { contract, build_warnings } = await buildEmailContract(supabase, userId, {
          engine: "improve-email",
          operation: "improve",
          partnerId: partner_id,
          contactId: contact_id ?? null,
          emailType: email_type_id || "generico",
          emailDescription: custom_goal || "",
          objective: custom_goal || undefined,
          existingDraft: { subject: subject, body: html_body, instructions: custom_goal },
        });
        const validation = validateEmailContract(contract);
        contractWarningsImprove.push(...build_warnings, ...validation.warnings);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "CONTRACT_INVALID",
              errors: validation.errors,
              warnings: validation.warnings,
            }),
            { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } },
          );
        }
        typeResolutionImprove = detectEmailType(contract);
        // FIX 3b-B: surface type conflicts as warnings (non-blocking, a differenza di generate-email)
        if (typeResolutionImprove && !typeResolutionImprove.proceed) {
          const blockingConflicts = typeResolutionImprove.conflicts
            ?.filter((c: { severity: string }) => c.severity === "blocking")
            .map((c: { suggestion: string }) => c.suggestion) ?? [];
          if (blockingConflicts.length) {
            contractWarningsImprove.push(`TYPE_CONFLICT (non-blocking): ${blockingConflicts.join("; ")}`);
          }
        }
      } catch (cerr) {
        console.warn("[improve-email] contract/detector failed (non-blocking):", cerr instanceof Error ? cerr.message : cerr);
      }
    }

    // ── Settings ──
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "ai_%");
    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: { key: string; value: string | null }) => { settings[r.key] = r.value || ""; });

    const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
    const senderCompany = settings.ai_company_alias || settings.ai_company_name || "";

    // ── Context (partner/contact + history) ──
    const { partner, contact } = await loadPartnerContact(supabase, partner_id || null, contact_id || null);
    const history = await loadHistoryStats(supabase, partner_id || null);
    const isFollowUp = email_type_id === "follow_up" || history.touchCount > 0;

    // ── Fix 4 (Gap F): allinea _context_summary con generate-email — warmth/commercial_state/playbook ──
    let warmthScore: number | null = null;
    let commercialState: string | null = null;
    let lastOutcome: string | null = null;
    let playbookActive = false;
    if (partner_id) {
      try {
        const { analyzeRelationshipHistory } = await import("../_shared/sameLocationGuard.ts");
        const { metrics } = await analyzeRelationshipHistory(supabase, partner_id, userId);
        const m = metrics as Record<string, unknown>;
        warmthScore = typeof m.warmth_score === "number" ? m.warmth_score : null;
        commercialState = (m.commercial_state as string | undefined) ?? (partner?.lead_status as string | null) ?? null;
        lastOutcome = (m.last_outcome as string | undefined) ?? null;
      } catch (e) {
        console.warn("[improve-email] relationship analysis failed:", e instanceof Error ? e.message : e);
      }
      // Active playbook flag (lightweight check)
      const { data: state } = await supabase
        .from("partner_workflow_state")
        .select("workflow_id")
        .eq("user_id", userId)
        .eq("partner_id", partner_id)
        .eq("status", "active")
        .maybeSingle();
      playbookActive = !!state?.workflow_id;
    }

    // ── LOVABLE-72: Enrichment unificato (Base + Deep Local + Legacy + Sherlock) ──
    let enrichmentContext = "";
    if (partner_id) {
      try {
        const unified = await readUnifiedEnrichment(partner_id, supabase);
        if (unified.has_any) {
          // FIX 3b-G: usa quality param (allineato con generate-email)
          const block = formatEnrichmentForPrompt(unified, quality);
          if (block) enrichmentContext = `\nDATI ARRICCHIMENTO PARTNER:\n${block}\n`;
        }
      } catch (e) {
        console.warn("[improve-email] enrichment read failed:", e instanceof Error ? e.message : e);
      }
    }

    // ── KB strategica (filtrata per tipo) ──
    // FIX 3b-I: pass email_type_kb_categories (allineato con generate-email)
    const extraKbCats = Array.isArray(email_type_kb_categories) ? email_type_kb_categories as string[] : undefined;
    const kbResult = use_kb !== false
      ? await fetchKbEntriesForImprove(supabase, userId, email_type_id || null, isFollowUp, extraKbCats)
      : { text: "", sections: [] };
    const fullSalesKB = settings.ai_sales_knowledge_base || "";
    if (!kbResult.text && fullSalesKB) {
      console.warn("[improve-email] kb_entries vuoto, fallback monolitico");
    }

    // ── Decision Object ──
    const improvementFocus = isFollowUp
      ? "urgenza_soft_e_cta_specifica"
      : email_type_id === "primo_contatto"
        ? "hook_e_personalizzazione"
        : email_type_id === "proposta"
          ? "concretezza_e_valore"
          : "struttura_e_impatto";

    const decision = {
      email_type: email_type_id || "generico",
      tone: oracle_tone || settings.ai_tone || "professionale",
      max_length_lines: 12,
      improvement_focus: improvementFocus,
      is_follow_up: isFollowUp,
      touch_count: history.touchCount,
    };

    const readiness = {
      sender: [
        settings.ai_contact_alias || settings.ai_contact_name ? 30 : 0,
        settings.ai_company_alias || settings.ai_company_name ? 30 : 0,
        settings.ai_knowledge_base ? 20 : 0,
        settings.ai_contact_role ? 20 : 0,
      ].reduce((a, b) => a + b, 0),
      kb: kbResult.text ? Math.min(100, kbResult.sections.length * 20) : 0,
      context: (partner ? 50 : 0) + (history.touchCount > 0 ? 30 : 0) + (contact ? 20 : 0),
    };

    // ── Recipient context block ──
    let recipientBlock = "";
    if (partner) {
      recipientBlock += `\nDESTINATARIO:\n- Azienda: ${partner.company_alias || partner.company_name}\n- Paese: ${partner.country_name || "?"}\n- Città: ${partner.city || "?"}\n- Lead status: ${partner.lead_status || "?"}\n`;
      if (contact) {
        recipientBlock += `- Contatto: ${contact.contact_alias || contact.name || "?"}${contact.title ? ` (${contact.title})` : ""}\n`;
      }
    }
    if (history.touchCount > 0) {
      recipientBlock += `\nSTORIA RELAZIONE:\n- Interazioni precedenti: ${history.touchCount}\n- Ultimo contatto: ${history.daysSince != null ? `${history.daysSince} giorni fa` : "?"} via ${history.lastChannel || "?"}\n- ⚠️ ATTENZIONE: questa NON è una prima email. EVITA frasi tipo "Mi chiamo X", "Volevo presentarmi", "Vi scrivo per la prima volta".\n`;
    }

    // ── Coherence check ──
    let coherenceWarning = "";
    if (email_type_id === "primo_contatto" && history.touchCount > 0) {
      coherenceWarning = `\n⚠️ INCOERENZA RILEVATA: tipo selezionato "primo_contatto" ma esistono ${history.touchCount} interazioni precedenti. Trattalo come FOLLOW-UP, non ripetere presentazione.\n`;
    }

    const systemPrompt = `Sei un EDITOR GIORNALISTA esperto al servizio di WCA Network (la più grande alleanza globale di freight forwarder indipendenti).
Il tuo compito è MIGLIORARE un'email scritta manualmente dall'utente, NON riscriverla da zero.
Mantieni voce, intento e stile dell'autore; alza la qualità editoriale e l'aderenza alla filosofia WCA.

## 🌍 Filosofia WCA (sempre sotto ogni miglioramento)
Il destinatario è un'azienda di trasporti/logistica = partner potenziale.
Ciò che WCA offre di rivoluzionario al partner:
  • essere PRIMI ad avere tariffe su rotte chiave (rete agenti corrispondenti);
  • essere PRIMI a fare booking su capacità scarsa;
  • essere PRIMI a partire grazie a partner affidabili in destination;
  • essere PRIMI ad avere informazioni di mercato che danno vantaggio competitivo locale.
L'email deve far PERCEPIRE questa filosofia, anche senza elencarla.

DECISION OBJECT (contesto per il miglioramento):
${JSON.stringify(decision, null, 2)}

${recipientBlock}${coherenceWarning}

${enrichmentContext}
${custom_goal ? `OBIETTIVO DICHIARATO DALL'UTENTE:\n${custom_goal}\nDai PRIORITÀ a questo obiettivo nel migliorare il messaggio.\n` : ""}

## Come migliora un editor (non un copywriter)
1. LEGGI il dossier sul partner (sopra) per farti un'idea precisa di chi è il destinatario.
2. ANALIZZA l'email: hook, argomentazione, CTA, lunghezza. Identifica dove non si percepisce che è scritta per LUI.
3. RIANCORA l'apertura a un fatto concreto del dossier (servizio, città, network, segnale Sherlock).
4. RIDUCI a UNA idea forte: se l'utente ha messo 3 messaggi, scegli il più rilevante e taglia gli altri.
5. CTA leggera, specifica, a basso impegno. Mai pressione, mai entusiasmo finto.
6. TAGLIA superfluo: ogni riga deve avere scopo. 80-150 parole nel corpo.
7. FOCUS principale richiesto: ${improvementFocus}

PROFILO MITTENTE:
- Nome: ${senderAlias}
- Azienda: ${senderCompany}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Tono preferito: ${oracle_tone || settings.ai_tone || "professionale"}

${use_kb !== false && settings.ai_knowledge_base ? `KNOWLEDGE BASE AZIENDALE:\n${settings.ai_knowledge_base}\n` : ""}
${use_kb !== false && kbResult.text ? `# TECNICHE DI VENDITA E COMUNICAZIONE (${kbResult.sections.join(", ")}):\nApplica queste tecniche dove migliorano l'email.\n\n${kbResult.text}\n` : ""}
${settings.ai_style_instructions ? `ISTRUZIONI STILE: ${settings.ai_style_instructions}\n` : ""}
${email_type_prompt ? `\nLINEE GUIDA TIPO EMAIL "${email_type_id}":\n${email_type_prompt}\n` : ""}
${email_type_structure ? `STRUTTURA EMAIL RICHIESTA:\n${email_type_structure}\n` : ""}
${effectiveLearnedPatterns ? `REGOLE E PREFERENZE APPRESE (rispettale obbligatoriamente):\n${effectiveLearnedPatterns}\n` : ""}
REGOLE DI MIGLIORAMENTO:
1. Mantieni la STESSA lingua dell'email originale.
2. Mantieni voce e personalità dell'autore — alzi la qualità, non lo trasformi.
3. VIETATO inventare numeri %, KPI, casi cliente, certificazioni, partnership che non sono nel dossier.
4. Applica le tecniche KB dove sono NATURALI; non forzare.
5. Correggi grammatica e punteggiatura.
6. Mantieni intatte le variabili template ({{company_name}}, {{contact_name}}, ecc.).
7. Email concisa: 80-150 parole nel corpo.
8. Migliora anche il subject: specifico, non promozionale, senza punti esclamativi.
9. Output HTML valido per email (<p>, <br/>, <strong>, <em>; <ul>/<li> solo se davvero necessari).
10. NON aggiungere firma — viene gestita separatamente.

${recipient_count ? `Questa email sarà inviata a ${recipient_count} destinatari${recipient_countries ? ` in: ${recipient_countries}` : ""}.` : ""}

Rispondi SOLO con:
Subject: <oggetto migliorato>

<corpo HTML migliorato>`;

    const userPrompt = `Ecco l'email da migliorare:

${subject ? `Oggetto originale: ${subject}\n` : ""}
Corpo:
${html_body}`;

    const maxTokens = await getMaxTokensForFunction(supabase, userId, "ai_max_tokens_improve_email", 1500);
    const result = await aiChat({
      models: ["google/gemini-3-flash-preview", "openai/gpt-5-mini"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      timeoutMs: 30000,
      maxRetries: 1,
      max_tokens: maxTokens,
      context: `improve-email:${userId.substring(0, 8)}`,
    });
    const rawText = result.content || "";

    let improvedSubject = subject || "";
    let improvedBody = rawText;

    const subjectMatch = rawText.match(/^Subject:\s*(.+?)(?:\n|$)/im);
    if (subjectMatch) {
      improvedSubject = subjectMatch[1].trim();
      improvedBody = rawText.substring(subjectMatch[0].length).trim();
    }

    improvedBody = improvedBody.replace(/^```html?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    // ── GIORNALISTA AI — Caporedattore Finale ──
    let journalistResult: JournalistReviewOutput | null = null;
    try {
      const optimus = await loadOptimusSettings(supabase, userId);
      if (optimus.enabled && improvedBody) {
        journalistResult = await journalistReview(supabase, userId, {
          final_draft: improvedBody,
          resolved_brief: {
            email_type: email_type_id ?? undefined,
            objective: custom_goal ?? undefined,
            playbook_active: playbookActive ? "yes" : undefined,
          },
          channel: "email",
          commercial_state: {
            lead_status: (commercialState as string) || partner?.lead_status || "new",
            touch_count: history.touchCount,
            last_outcome: lastOutcome ?? undefined,
            days_since_last_inbound: history.daysSince ?? undefined,
            has_active_conversation: history.touchCount > 0,
          },
          partner: {
            id: partner_id ?? null,
            company_name: partner?.company_alias || partner?.company_name,
            country: partner?.country_name,
          },
          contact: contact ? { name: contact.contact_alias || contact.name, role: contact.title } : undefined,
          // FIX 3b-D: pass history to journalist (allineato con generate-email)
          history_summary: history.touchCount > 0
            ? `${history.touchCount} interazioni, ultimo ${history.daysSince ?? "?"} gg fa via ${history.lastChannel || "?"}`
            : undefined,
          kb_summary: kbResult.sections.join(", ") || undefined,
          is_reply: isFollowUp || history.touchCount > 0,
        }, { mode: optimus.mode, strictness: optimus.strictness });
        if (journalistResult.verdict !== "block" && journalistResult.edited_text) {
          improvedBody = journalistResult.edited_text;
        }
      }
    } catch (jerr) {
      console.error("[improve-email] journalistReview failed:", jerr);
    }

    return new Response(JSON.stringify({
      subject: improvedSubject,
      body: improvedBody,
      readiness,
      decision,
      journalist_review: journalistResult ? {
        journalist: journalistResult.journalist,
        verdict: journalistResult.verdict,
        warnings: journalistResult.warnings,
        edits: journalistResult.edits,
        quality_score: journalistResult.quality_score,
        reasoning: journalistResult.reasoning_summary,
      } : null,
      _context_summary: {
        kb_sections: kbResult.sections,
        touch_count: history.touchCount,
        days_since_last_contact: history.daysSince,
        last_channel: history.lastChannel,
        last_outcome: lastOutcome,
        warmth_score: warmthScore,
        commercial_state: commercialState,
        playbook_active: playbookActive,
        coherence_warning: !!coherenceWarning,
        partner_loaded: !!partner,
        contact_loaded: !!contact,
        oracle_type: email_type_id ?? null,
      },
      contract_used: true,
      contract_warnings: contractWarningsImprove,
      type_resolution: typeResolutionImprove,
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("improve-email error:", e);
    return mapErrorToResponse(e, getCorsHeaders(req.headers.get("origin")));
  }
});
