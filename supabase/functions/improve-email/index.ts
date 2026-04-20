import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";

interface KbEntry { title: string; content: string; category: string; chapter: string; tags: string[]; }

async function fetchKbEntriesForImprove(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  emailTypeId: string | null,
  isFollowUp: boolean,
): Promise<{ text: string; sections: string[] }> {
  const categories: string[] = ["regole_sistema", "filosofia", "struttura_email", "hook"];
  if (emailTypeId === "follow_up" || isFollowUp) categories.push("followup", "chris_voss", "obiezioni");
  if (emailTypeId === "primo_contatto") categories.push("cold_outreach");
  categories.push("negoziazione", "tono", "frasi_modello");
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

    const {
      subject, html_body, recipient_count, recipient_countries,
      oracle_tone, use_kb,
      email_type_id, email_type_prompt, email_type_structure,
      custom_goal, partner_id, contact_id,
    } = await req.json();
    if (!html_body) throw new Error("html_body is required");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

    // ── KB strategica (filtrata per tipo) ──
    const kbResult = use_kb !== false
      ? await fetchKbEntriesForImprove(supabase, userId, email_type_id || null, isFollowUp)
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

    const systemPrompt = `Sei un esperto copywriter, stratega di vendita B2B e consulente di comunicazione nel settore della logistica internazionale e del freight forwarding.

Il tuo compito è MIGLIORARE un'email scritta manualmente dall'utente. NON riscriverla da zero — mantieni il messaggio, lo stile e l'intento dell'autore.

DECISION OBJECT (contesto per il miglioramento):
${JSON.stringify(decision, null, 2)}

${recipientBlock}${coherenceWarning}

${custom_goal ? `OBIETTIVO DICHIARATO DALL'UTENTE:\n${custom_goal}\nDai PRIORITÀ a questo obiettivo nel migliorare il messaggio.\n` : ""}

## Come migliorare:
1. ANALIZZA l'email e identifica punti deboli (hook mancante, CTA assente, tono piatto, struttura confusa)
2. APPLICA tecniche dalla KB: Label, Mirroring, domande calibrate, urgenza soft — dove appropriato
3. RAFFORZA la call-to-action: se manca, aggiungine una. Se è debole, rendila specifica.
4. MIGLIORA l'hook iniziale: la prima riga deve catturare l'attenzione (e tenere conto della STORIA se presente)
5. TAGLIA il superfluo: ogni riga deve avere uno scopo
6. FOCUS principale: ${improvementFocus}

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

REGOLE DI MIGLIORAMENTO:
1. Mantieni la STESSA lingua dell'email originale
2. Mantieni lo STESSO tono e stile dell'autore — non cambiare la personalità
3. Migliora: hook iniziale, struttura, scelta parole, CTA, impatto commerciale
4. Applica le tecniche dalla KB dove NATURALE (non forzare)
5. Correggi errori grammaticali e di punteggiatura
6. Mantieni le variabili template ({{company_name}}, {{contact_name}}, ecc.) INTATTE
7. NON allungare inutilmente — l'email deve rimanere concisa (max 10-15 righe)
8. Se l'email ha un oggetto, miglora anche quello con più impatto
9. L'output DEVE essere HTML valido per email (usa <p>, <br/>, <strong>, <em>, <ul>, <li>)
10. NON aggiungere firma — viene gestita separatamente

${recipient_count ? `Questa email sarà inviata a ${recipient_count} destinatari${recipient_countries ? ` in: ${recipient_countries}` : ""}.` : ""}

Rispondi SOLO con:
Subject: <oggetto migliorato>

<corpo HTML migliorato>`;

    const userPrompt = `Ecco l'email da migliorare:

${subject ? `Oggetto originale: ${subject}\n` : ""}
Corpo:
${html_body}`;

    const result = await aiChat({
      models: ["google/gemini-3-flash-preview", "openai/gpt-5-mini"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      timeoutMs: 30000,
      maxRetries: 1,
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

    return new Response(JSON.stringify({
      subject: improvedSubject,
      body: improvedBody,
      readiness,
      decision,
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
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("improve-email error:", e);
    return mapErrorToResponse(e, getCorsHeaders(req.headers.get("origin")));
  }
});
