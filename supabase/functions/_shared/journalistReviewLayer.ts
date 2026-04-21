// === JournalistReviewLayer — Caporedattore Finale (LOVABLE-80 v2) ===
// One-way editorial layer: legge tutto, corregge il testo, segnala problemi.
// NON riscrive il brief di business. MAI cambia stato/canale/playbook.

import type {
  JournalistReviewInput,
  JournalistReviewOutput,
  JournalistWarning,
  JournalistEdit,
  ReviewVerdict,
  JournalistConfig,
  JournalistRole,
  ReviewMode,
} from "./journalistTypes.ts";
import {
  selectJournalist,
  loadJournalistConfig,
  validateOverride,
  JOURNALIST_LABELS,
} from "./journalistSelector.ts";
import { aiChat } from "./aiGateway.ts";

export interface JournalistReviewOptions {
  overrideRole?: JournalistRole;
  mode?: ReviewMode;
  /** 1-10 */
  strictness?: number;
  /** Modello LLM da usare per la review */
  model?: string;
}

// deno-lint-ignore no-explicit-any
export async function journalistReview(
  supabase: any,
  userId: string,
  input: JournalistReviewInput,
  options?: JournalistReviewOptions,
): Promise<JournalistReviewOutput> {
  // === Step 1: selezione giornalista ===
  const autoSelection = selectJournalist(input.commercial_state.lead_status, {
    touch_count: input.commercial_state.touch_count,
    last_outcome: input.commercial_state.last_outcome,
    daysSinceLastInbound: input.commercial_state.days_since_last_inbound,
    hasActiveConversation:
      input.commercial_state.has_active_conversation ?? !!input.history_summary,
  });

  if (!autoSelection) {
    // Blacklisted → block immediato
    return {
      journalist: {
        role: "rompighiaccio",
        label: "BLOCCATO",
        reasoning: "Blacklisted",
        auto: true,
      },
      verdict: "block",
      edited_text: "",
      warnings: [
        {
          type: "tone_violation",
          description: "Partner blacklisted — nessuna comunicazione permessa",
          severity: "blocking",
        },
      ],
      edits: [],
      reasoning_summary: "Comunicazione bloccata: partner in blacklist.",
      quality_score: 0,
    };
  }

  // === Override manuale ===
  let journalist = autoSelection;
  const overrideWarnings: JournalistWarning[] = [];

  if (options?.overrideRole && options.overrideRole !== autoSelection.role) {
    const validation = validateOverride(
      options.overrideRole,
      input.commercial_state.lead_status,
      autoSelection,
    );
    if (validation.warning) {
      overrideWarnings.push({
        type: "phase_skip",
        description: validation.warning,
        severity: "warning",
      });
    }
    journalist = {
      role: options.overrideRole,
      label: `${JOURNALIST_LABELS[options.overrideRole]} (override)`,
      reasoning: `Override manuale (auto era ${autoSelection.label})`,
      auto: false,
    };
  }

  // === Step 2: carica config ===
  const config = await loadJournalistConfig(supabase, userId, journalist.role);
  const mode: ReviewMode = options?.mode || "review_and_correct";
  const strictness = Math.max(1, Math.min(10, options?.strictness ?? 7));

  // === Step 3: prompt + LLM ===
  const systemPrompt = buildReviewSystemPrompt(config, input, mode, strictness);
  const userPrompt = buildReviewUserPrompt(input);
  const model = options?.model || "google/gemini-2.5-flash";

  let responseText = "";
  try {
    const result = await aiChat({
      models: [model, "google/gemini-3-flash-preview", "openai/gpt-5-mini"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      timeoutMs: 25000,
      maxRetries: 1,
      context: `journalist-review:${userId.substring(0, 8)}`,
    });
    responseText = result.content || "";
  } catch (err) {
    console.error("[journalistReview] LLM error:", err);
    return {
      journalist,
      verdict: "pass",
      edited_text: input.final_draft,
      warnings: [...overrideWarnings],
      edits: [],
      reasoning_summary: "Review non eseguita (errore LLM). Draft originale mantenuto.",
      quality_score: -1,
    };
  }

  // === Step 4: parse ===
  const parsed = parseReviewResponse(responseText, input.final_draft);

  const editedText =
    mode === "review_only" || mode === "silent_audit"
      ? input.final_draft
      : parsed.verdict === "block"
      ? input.final_draft // anche su block: non sovrascriviamo, l'UI mostra banner
      : parsed.edited_text;

  return {
    journalist,
    verdict: parsed.verdict,
    edited_text: editedText,
    warnings: [...overrideWarnings, ...parsed.warnings],
    edits: parsed.edits,
    reasoning_summary: parsed.reasoning_summary,
    quality_score: parsed.quality_score,
  };
}

function buildReviewSystemPrompt(
  config: JournalistConfig,
  input: JournalistReviewInput,
  mode: ReviewMode,
  strictness: number,
): string {
  const channelRules: Record<string, string> = {
    email: "Formato email professionale. Lunghezza appropriata. Firma coerente.",
    whatsapp: "Max 300 caratteri. Niente formalismi. Una domanda alla volta. Diretto ma rispettoso.",
    linkedin: "Professionale ma personale. Riferimenti profilo. Breve e mirato.",
    voice_script:
      "Frasi BREVI. Ritmo naturale. ZERO tecnicismi. Pensato per essere LETTO AD ALTA VOCE da TTS. Pause naturali. UNA SOLA domanda.",
  };

  const briefBlock = [
    input.resolved_brief?.email_type && `TIPO: ${input.resolved_brief.email_type}`,
    input.resolved_brief?.email_description && `DESCRIZIONE: ${input.resolved_brief.email_description}`,
    input.resolved_brief?.objective && `OBIETTIVO: ${input.resolved_brief.objective}`,
    input.resolved_brief?.playbook_active && `PLAYBOOK ATTIVO: ${input.resolved_brief.playbook_active}`,
  ].filter(Boolean).join("\n");

  const ctxBlock = [
    input.history_summary && `HISTORY: ${input.history_summary}`,
    input.kb_summary && `KB RILEVANTE: ${input.kb_summary}`,
    input.memory_summary && `MEMORY: ${input.memory_summary}`,
    input.enrichment_summary && `ENRICHMENT: ${input.enrichment_summary}`,
    input.constraints?.length && `VINCOLI: ${input.constraints.join("; ")}`,
  ].filter(Boolean).join("\n");

  return `Sei il CAPOREDATTORE FINALE di WCA Network Navigator.

## RUOLO (confini precisi)

SEI AUTORIZZATO A:
- Correggere ritmo, ridondanza, tecnicismo, freddezza, aggressività
- Migliorare forza narrativa e CTA
- Adattare tono al giornalista attivo (${config.label})
- Segnalare incoerenze tra testo e brief/stato/history
- Bloccare promesse non verificabili, urgenza finta, adulazione, salti di fase
- Adattare formato al canale (${input.channel})

NON SEI AUTORIZZATO A:
- Cambiare la strategia commerciale del messaggio
- Decidere o cambiare lo stato del partner
- Scegliere un canale diverso
- Modificare il playbook o il brief
- Inventare informazioni non presenti nei summaries
- Bypassare guardrail del sistema
- Archiviare, qualificare o de-qualificare un partner
- Riscrivere l'obiettivo del messaggio

SE TROVI UNA CONTRADDIZIONE FORTE (es. tipo="primo contatto" ma history=2 email):
- NON inventare la soluzione silenziosamente
- Verdict "warn" o "block"
- Spiega in warnings[]
- Suggerisci correzione A MONTE in upstream_fix

## GIORNALISTA ATTIVO: ${config.label}
PROMPT: ${config.prompt}
TONO: ${config.tone}
REGOLE: ${config.rules}
COSE DA NON DIRE: ${config.donts}
FONTI KB: ${config.kb_sources}

## CONTESTO (leggi, NON modificare la sostanza)
PARTNER: ${input.partner.company_name || "N/A"} (${input.partner.country || "N/A"})
STATO: ${input.commercial_state.lead_status}${
    input.commercial_state.relationship_phase ? ` — ${input.commercial_state.relationship_phase}` : ""
  }
${input.commercial_state.touch_count !== undefined ? `TOUCH COUNT: ${input.commercial_state.touch_count}` : ""}
${input.commercial_state.last_outcome ? `ULTIMO ESITO: ${input.commercial_state.last_outcome}` : ""}
${input.contact ? `CONTATTO: ${input.contact.name || "N/A"} (${input.contact.role || "N/A"})` : ""}
${briefBlock}
${ctxBlock}

## CANALE: ${input.channel}
${channelRules[input.channel] || ""}

## I TUOI 5 COMPITI
1. COHERENCE CHECK: testo coerente con stato, fase, tipo, history, obiettivo? → se NO: verdict "warn" + upstream_fix.
2. EDITORIAL POLISH: ritmo, ridondanza, tecnicismo, freddezza, aggressività, CTA → correggi e documenta in edits[].
3. ROLE ADAPTATION: il testo suona ${config.label} (${config.tone})? → correggi il tono, NON la sostanza.
4. SAFETY EDITORIALE: promesse non verificabili? urgenza finta? adulazione? salto di fase? → "warn" o "block".
5. COERENZA CANALE: formato appropriato per ${input.channel}? ${input.channel === "voice_script" ? "Spezza frasi, ritmo parlato, una domanda." : "Verifica formato/lunghezza."}

## MODALITÀ: ${mode}
${mode === "review_only" ? "Valuta SENZA modificare. edited_text = draft originale." : ""}
${mode === "review_and_correct" ? "Valuta E correggi. edited_text = versione migliorata." : ""}
${mode === "silent_audit" ? "Solo audit interno. edited_text = draft originale." : ""}

## RIGORE: ${strictness}/10
${strictness >= 8 ? "MOLTO esigente: anche piccole imprecisioni di tono vanno corrette/segnalate." : ""}
${strictness >= 5 && strictness < 8 ? "Correggi problemi evidenti. Tollera variazioni di stile." : ""}
${strictness < 5 ? "Solo errori gravi: regole violate, tono completamente sbagliato, errori fattuali." : ""}

## REGOLE TRASVERSALI INVIOLABILI
- Mai urgenza finta. Mai adulazione. Mai promesse non verificabili.
- Distingui partner (collaborazione) da cliente finale (operatività).
- Una domanda alla volta nei vocali. Frasi brevi.

## FORMATO RISPOSTA (SOLO JSON, niente markdown attorno)
{
  "verdict": "pass" | "pass_with_edits" | "warn" | "block",
  "edited_text": "testo finale (o draft originale se pass/review_only)",
  "warnings": [
    { "type": "brief_mismatch|phase_skip|tone_violation|unverifiable_claim|fake_urgency|flattery|channel_mismatch|type_history_conflict", "description": "...", "severity": "info|warning|blocking", "upstream_fix": "opzionale" }
  ],
  "edits": [
    { "type": "tone|rhythm|redundancy|technicality|aggression|cta_clarity|length|channel_format|role_voice", "original_fragment": "...", "edited_fragment": "...", "reason": "..." }
  ],
  "reasoning_summary": "max 2 frasi per l'utente",
  "quality_score": 0-100
}`;
}

function buildReviewUserPrompt(input: JournalistReviewInput): string {
  const channelLabel =
    input.channel === "email"
      ? "email"
      : input.channel === "whatsapp"
      ? "messaggio WhatsApp"
      : input.channel === "linkedin"
      ? "messaggio LinkedIn"
      : "script vocale";

  return `Rivedi questo ${channelLabel} per ${input.partner.company_name || "un partner"} (stato: ${input.commercial_state.lead_status}):

---
${input.final_draft}
---

Esegui i 5 compiti. Rispondi in JSON puro.`;
}

function parseReviewResponse(
  response: string,
  originalDraft: string,
): {
  verdict: ReviewVerdict;
  edited_text: string;
  warnings: JournalistWarning[];
  edits: JournalistEdit[];
  reasoning_summary: string;
  quality_score: number;
} {
  try {
    // Strip ```json fences se presenti
    let cleaned = response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    cleaned = jsonMatch[0];
    const parsed = JSON.parse(cleaned);

    const verdict: ReviewVerdict =
      ["pass", "pass_with_edits", "warn", "block"].includes(parsed.verdict)
        ? parsed.verdict
        : "pass";

    return {
      verdict,
      edited_text:
        typeof parsed.edited_text === "string" && parsed.edited_text.trim().length > 0
          ? parsed.edited_text
          : originalDraft,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      edits: Array.isArray(parsed.edits) ? parsed.edits : [],
      reasoning_summary:
        typeof parsed.reasoning_summary === "string" ? parsed.reasoning_summary : "",
      quality_score:
        typeof parsed.quality_score === "number"
          ? Math.max(0, Math.min(100, parsed.quality_score))
          : 50,
    };
  } catch (e) {
    console.error("[journalistReview] parse error:", e);
    return {
      verdict: "pass",
      edited_text: originalDraft,
      warnings: [],
      edits: [],
      reasoning_summary: "Review parse error. Draft originale mantenuto.",
      quality_score: -1,
    };
  }
}