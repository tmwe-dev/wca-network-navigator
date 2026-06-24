import type { Tool, ToolResult } from "../types";
import { detectTone } from "../../lib/toneDetector";
import {
  getLastComposerContext,
  isRegenerateIntent,
  setLastComposerContext,
} from "../../lib/composerContext";
import {
  getLastQueryResultContext,
  isProceedIntent,
  setLastQueryResultContext,
} from "../../lib/lastQueryResultContext";
import {
  detectCountryCode,
  extractPartnersFromContextPayload,
  extractPersonAndCompany,
  isCountryWideIntent,
  looksLikeGenericInvite,
  resolveNaturalPrompt,
  detectCountryFromHistory,
  isSingleSampleIntent,
  readComposeParams,
  type ComposeParams,
} from "./promptParse";
import {
  fetchPartnersByFilters,
  fetchPartnersByIds,
  searchPartner,
  searchPartnersByCountry,
} from "./partnerQueries";
import { buildBatchComposerResult, generateDraftsBatch } from "./batchDrafts";
import { buildSingleComposerResult } from "./singleDraft";
import type { PartnerRow } from "./types";

/**
 * PROMPT FREEDOM — esecuzione guidata dai parametri semantici risolti dall'AI.
 *
 * Non re-interpreta il linguaggio naturale: consuma i parametri e applica solo
 * le guardrail (destinatario inesistente, ambiguità, blacklist). Ritorna `null`
 * quando i parametri non bastano a identificare un destinatario, lasciando il
 * controllo alla logica fallback (regex) a valle.
 */
async function executeFromParams(
  params: ComposeParams,
  prompt: string,
): Promise<ToolResult | null> {
  const tone = params.tone ?? detectTone(prompt);
  const goal = params.intent ?? prompt;

  // A) Destinatario singolo identificato da email o azienda.
  if (params.email || params.company) {
    const candidates = await searchPartner(params.company, params.email);
    if (candidates.length === 0) {
      const parts: string[] = [];
      if (params.company) parts.push(`azienda "${params.company}"`);
      if (params.person) parts.push(`persona "${params.person}"`);
      if (params.email) parts.push(`email ${params.email}`);
      return {
        kind: "report",
        title: "Destinatario non trovato",
        meta: { count: 0, sourceLabel: "DB · partners + partner_contacts" },
        sections: [{
          heading: "Verifica Oracolo",
          body: `Non ho trovato nessun partner che corrisponda a ${parts.join(", ") || "i dati indicati"}.\n\nConferma la ragione sociale esatta o il dominio email, oppure censisci prima il partner.`,
        }],
      };
    }
    if (candidates.length > 1 && !params.email) {
      const list = candidates
        .map((c, i) => `${i + 1}. **${c.company_name}**${c.city ? ` — ${c.city}` : ""}${c.country_code ? ` (${c.country_code})` : ""} · status: ${c.lead_status ?? "n/d"}`)
        .join("\n");
      return {
        kind: "report",
        title: "Più partner corrispondono",
        meta: { count: candidates.length, sourceLabel: "DB · partners" },
        sections: [{
          heading: "Verifica Oracolo — disambiguazione",
          body: `Ho trovato ${candidates.length} partner che corrispondono a "${params.company}". Indicami quale (città o nazione) prima di procedere:\n\n${list}`,
        }],
      };
    }
    const partner = candidates[0];
    if (partner.lead_status === "blacklisted") {
      return {
        kind: "report",
        title: "Invio bloccato dall'Oracolo",
        meta: { count: 1, sourceLabel: "DB · partners" },
        sections: [{
          heading: partner.company_name,
          body: `Questo partner è in **blacklist**${partner.status_reason ? ` (motivo: ${partner.status_reason})` : ""}. Non posso preparare email per loro.`,
        }],
      };
    }
    return buildSingleComposerResult({ partner, person: params.person, email: params.email, prompt: goal });
  }

  // B) Destinatari per paese.
  if (params.countryCode) {
    const partners = await searchPartnersByCountry(params.countryCode);
    const label = params.countryLabel ?? params.countryCode;
    if (partners.length === 0) {
      return {
        kind: "report",
        title: `Nessun partner in ${label.toUpperCase()}`,
        meta: { count: 0, sourceLabel: "DB · partners" },
        sections: [{
          heading: "Verifica Oracolo",
          body: `Non ho trovato partner attivi in ${label} (${params.countryCode}). Controlla il filtro paese o importa prima i contatti.`,
        }],
      };
    }

    // Singolo esempio richiesto → bozza per il primo partner.
    if (params.scope === "single" || partners.length === 1) {
      setLastQueryResultContext({
        partnerIds: partners.map((p) => p.id),
        countryCode: params.countryCode,
        countryLabel: label,
        originalPrompt: prompt,
        selectionLabel: `partner in ${label}`,
        count: partners.length,
      });
      return buildSingleComposerResult({ partner: partners[0], person: null, email: null, prompt: goal });
    }

    // Altrimenti batch per tutti i partner del paese.
    const drafts = await generateDraftsBatch(partners, tone, goal);
    setLastComposerContext({
      countryCode: params.countryCode,
      countryLabel: label,
      partnerIds: partners.map((p) => p.id),
      tone,
      originalGoal: goal,
    });
    return buildBatchComposerResult({
      partners, drafts, tone,
      countryCode: params.countryCode,
      countryLabel: label,
      prompt: goal,
    });
  }

  // Parametri insufficienti: lascia decidere alle guardrail fallback.
  return null;
}

export const composeEmailTool: Tool = {
  id: "compose-email",
  label: "Componi email",
  description: "Risolve partner/contatto, consulta Oracolo+Architetto e prepara la bozza con la pipeline ufficiale.",

  match(prompt: string): boolean {
    const p = prompt.toLowerCase();
    if (/(?:scriv|compon|invi|prepar|mand|gener|fai|redig).*(?:e-?mail|mail|messagg|lettera|invito|complimenti)|\bbozz[ae].*(?:e-?mail|mail)|\bemail\s+a\s|draft.*email/.test(p)) {
      return true;
    }
    if (isRegenerateIntent(prompt) && getLastComposerContext() !== null) return true;
    if (isProceedIntent(prompt) && getLastQueryResultContext() !== null) return true;
    return false;
  },

  async execute(promptInput: string, context): Promise<ToolResult> {
    const prompt = resolveNaturalPrompt(promptInput, context);
    const payloadSelection = extractPartnersFromContextPayload(context?.payload);

    // ── 0a) Follow-up: rigenerazione/rivisualizzazione bozze precedenti ──
    const lastCtx = getLastComposerContext();
    if (lastCtx && isRegenerateIntent(prompt)) {
      const tone = detectTone(prompt);
      const partners = await fetchPartnersByIds(lastCtx.partnerIds);
      if (partners.length === 0) {
        return {
          kind: "report",
          title: "Bozze precedenti non più disponibili",
          meta: { count: 0, sourceLabel: "DB · partners" },
          sections: [{
            heading: "Contesto perso",
            body: `I partner del batch precedente non sono più recuperabili. Riformula la richiesta indicando di nuovo il paese (es. "scrivi una mail amichevole ai partner di ${lastCtx.countryLabel}").`,
          }],
        };
      }
      const drafts = await generateDraftsBatch(partners, tone, lastCtx.originalGoal || prompt);
      setLastComposerContext({
        countryCode: lastCtx.countryCode,
        countryLabel: lastCtx.countryLabel,
        partnerIds: partners.map((p) => p.id),
        tone,
        originalGoal: lastCtx.originalGoal || prompt,
      });
      return buildBatchComposerResult({
        partners, drafts, tone,
        countryCode: lastCtx.countryCode,
        countryLabel: lastCtx.countryLabel,
        prompt,
      });
    }

    const queryCtx = getLastQueryResultContext();

    // ── 0b-pre) Esplicita country in proceed-intent ──
    const explicitCountry = detectCountryCode(prompt);
    if (explicitCountry && isProceedIntent(prompt)) {
      const partners = await searchPartnersByCountry(explicitCountry.code);
      if (partners.length > 0) {
        const tone = detectTone(prompt);
        const drafts = await generateDraftsBatch(partners, tone, prompt);
        setLastComposerContext({
          countryCode: explicitCountry.code,
          countryLabel: explicitCountry.label,
          partnerIds: partners.map((p) => p.id),
          tone,
          originalGoal: prompt,
        });
        return buildBatchComposerResult({
          partners, drafts, tone,
          countryCode: explicitCountry.code,
          countryLabel: explicitCountry.label,
          prompt,
        });
      }
    }

    // ── 0b) Proceed-with-context: l'utente conferma ("vai avanti…") ──
    if ((queryCtx || payloadSelection.partnerIds.length > 0 || payloadSelection.countryCode) && isProceedIntent(prompt)) {
      let partners: PartnerRow[] = [];
      const userExplicitSingle = payloadSelection.partnerIds.length === 1 && !queryCtx;
      const knownTotal = queryCtx?.count ?? null;
      const idsAreComplete =
        (queryCtx?.partnerIds.length ?? 0) > 0 &&
        (knownTotal === null || queryCtx!.partnerIds.length >= knownTotal);

      if (userExplicitSingle) {
        partners = await fetchPartnersByIds(payloadSelection.partnerIds);
      } else if (idsAreComplete) {
        partners = await fetchPartnersByIds(queryCtx!.partnerIds);
      } else if (queryCtx?.filters && queryCtx.filters.length > 0) {
        partners = await fetchPartnersByFilters(queryCtx.filters);
      } else if (queryCtx?.countryCode) {
        partners = await searchPartnersByCountry(queryCtx.countryCode);
      } else if (payloadSelection.partnerIds.length > 0) {
        partners = await fetchPartnersByIds(payloadSelection.partnerIds);
      } else if (payloadSelection.countryCode) {
        partners = await searchPartnersByCountry(payloadSelection.countryCode);
      } else if (queryCtx?.partnerIds.length) {
        partners = await fetchPartnersByIds(queryCtx.partnerIds);
      }
      if (partners.length === 0) {
        return {
          kind: "report",
          title: "Lista partner non più disponibile",
          meta: { count: 0, sourceLabel: "DB · partners" },
          sections: [{
            heading: "Contesto perso",
            body: `I partner trovati nella ricerca precedente non sono più recuperabili. Riformula la ricerca${queryCtx?.selectionLabel ? ` (selezione precedente: "${queryCtx.selectionLabel}")` : queryCtx?.countryLabel ? ` (es. "trovami i partner di ${queryCtx.countryLabel}")` : ""}.`,
          }],
        };
      }
      const tone = detectTone(prompt);
      const drafts = await generateDraftsBatch(partners, tone, prompt);
      const labelForCtx = queryCtx?.selectionLabel ?? queryCtx?.countryLabel ?? payloadSelection.countryCode ?? "selezione";
      const codeForCtx = queryCtx?.countryCode ?? payloadSelection.countryCode ?? "—";
      setLastComposerContext({
        countryCode: codeForCtx,
        countryLabel: labelForCtx,
        partnerIds: partners.map((p) => p.id),
        tone,
        originalGoal: prompt,
      });
      return buildBatchComposerResult({
        partners, drafts, tone,
        countryCode: codeForCtx,
        countryLabel: labelForCtx,
        prompt,
      });
    }

    // ── 0) Country-wide batch intent ──
    const country = detectCountryCode(prompt);
    if (country && isCountryWideIntent(prompt)) {
      const partners = await searchPartnersByCountry(country.code);
      if (partners.length === 0) {
        return {
          kind: "report",
          title: `Nessun partner in ${country.label.toUpperCase()}`,
          meta: { count: 0, sourceLabel: "DB · partners" },
          sections: [{
            heading: "Verifica Oracolo",
            body: `Non ho trovato partner attivi in ${country.label} (${country.code}). Controlla il filtro paese o importa prima i contatti.`,
          }],
        };
      }
      const tone = detectTone(prompt);
      const drafts = await generateDraftsBatch(partners, tone, prompt);
      setLastComposerContext({
        countryCode: country.code,
        countryLabel: country.label,
        partnerIds: partners.map((p) => p.id),
        tone,
        originalGoal: prompt,
      });
      return buildBatchComposerResult({
        partners, drafts, tone,
        countryCode: country.code,
        countryLabel: country.label,
        prompt,
      });
    }

    const { person, company, email } = extractPersonAndCompany(prompt);

    // ── 0c) Fallback contesto chat: nessun destinatario esplicito nel prompt
    // ma la conversazione recente indica un paese di lavoro (es. "9 partner a
    // Malta" → "preparane una per uno dei tanti"). Recuperiamo i partner dal
    // paese citato in chat invece di ripetere la domanda. ──
    if (!email && !company && !explicitCountry && !payloadSelection.partnerIds.length) {
      const histCountry = detectCountryFromHistory(context?.history);
      if (histCountry) {
        const partners = await searchPartnersByCountry(histCountry.code);
        if (partners.length > 0) {
          const tone = detectTone(prompt);
          // L'utente chiede un singolo esempio → bozza per il primo partner.
          if (isSingleSampleIntent(prompt) || partners.length === 1) {
            setLastQueryResultContext({
              partnerIds: partners.map((p) => p.id),
              countryCode: histCountry.code,
              countryLabel: histCountry.label,
              originalPrompt: prompt,
              selectionLabel: `partner in ${histCountry.label}`,
              count: partners.length,
            });
            return buildSingleComposerResult({ partner: partners[0], person: null, email: null, prompt });
          }
          // Altrimenti batch per tutti i partner del paese.
          const drafts = await generateDraftsBatch(partners, tone, prompt);
          setLastComposerContext({
            countryCode: histCountry.code,
            countryLabel: histCountry.label,
            partnerIds: partners.map((p) => p.id),
            tone,
            originalGoal: prompt,
          });
          return buildBatchComposerResult({
            partners, drafts, tone,
            countryCode: histCountry.code,
            countryLabel: histCountry.label,
            prompt,
          });
        }
      }
    }

    // Guardrail anti-falso partner
    if (looksLikeGenericInvite(prompt) && !email) {
      return {
        kind: "report",
        title: "Selezione destinatari mancante",
        meta: { count: 0, sourceLabel: "DB · partners" },
        sections: [{
          heading: "Conferma necessaria",
          body: `Il messaggio è un invito generico ma non ho una **selezione partner attiva** né un destinatario esplicito.\n\nFai prima una ricerca (es. "trovami i partner di Malta" o "elenca i partner ad Amman") e poi conferma con "prepara invito a tutti".`,
        }],
      };
    }

    // 1) Cerca partner
    const candidates = await searchPartner(company, email);

    if (candidates.length === 0) {
      const reasonParts: string[] = [];
      if (company) reasonParts.push(`azienda "${company}"`);
      if (person) reasonParts.push(`persona "${person}"`);
      if (email) reasonParts.push(`email ${email}`);
      const reasonStr = reasonParts.length > 0 ? reasonParts.join(", ") : "i dati indicati";
      return {
        kind: "report",
        title: "Destinatario non trovato",
        meta: { count: 0, sourceLabel: "DB · partners + partner_contacts" },
        sections: [{
          heading: "Verifica Oracolo",
          body: `Non ho trovato nessun partner che corrisponda a ${reasonStr}.\n\nPrima di scrivere l'email serve identificare il destinatario nel CRM. Puoi:\n• Confermare la ragione sociale esatta (es. "Transport Management Srl")\n• Fornire il dominio email del destinatario\n• Censire prima il partner con "aggiungi partner ${company ?? "..."}".`,
        }],
      };
    }

    if (candidates.length > 1 && !email) {
      const list = candidates
        .map((c, i) => `${i + 1}. **${c.company_name}**${c.city ? ` — ${c.city}` : ""}${c.country_code ? ` (${c.country_code})` : ""} · status: ${c.lead_status ?? "n/d"}`)
        .join("\n");
      return {
        kind: "report",
        title: "Più partner corrispondono",
        meta: { count: candidates.length, sourceLabel: "DB · partners" },
        sections: [{
          heading: "Verifica Oracolo — disambiguazione",
          body: `Ho trovato ${candidates.length} partner che corrispondono a "${company}". Indicami quale prima di procedere:\n\n${list}\n\nRiformula la richiesta specificando città o nazione (es. "scrivi a ${person ?? "Luca"} di ${candidates[0].company_name} ${candidates[0].city ?? ""}").`,
        }],
      };
    }

    const partner = candidates[0];

    if (partner.lead_status === "blacklisted") {
      return {
        kind: "report",
        title: "Invio bloccato dall'Oracolo",
        meta: { count: 1, sourceLabel: "DB · partners" },
        sections: [{
          heading: `${partner.company_name}`,
          body: `Questo partner è in **blacklist**${partner.status_reason ? ` (motivo: ${partner.status_reason})` : ""}. Non posso preparare email per loro. Se ritieni sia un errore, rimuovi prima la blacklist dal CRM.`,
        }],
      };
    }

    return buildSingleComposerResult({ partner, person, email, prompt });
  },
};