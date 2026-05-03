import type { Tool, ToolResult, ComposerDraft } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { detectTone, toneLabel, type DetectedTone } from "../lib/toneDetector";
import type { EmailPipelineStage } from "../canvas/EmailPipelineBadge";

/* ── Pipeline builder (Oracolo→Architetto→Prompt Lab→Giornalista→Bozza) ── */
interface BuildPipelineArgs {
  partner: Pick<PartnerRow, "company_name" | "lead_status" | "status_reason"> | null;
  tone: DetectedTone;
  hasContact?: boolean;
  contactEmailMissing?: boolean;
  kbCount?: number;
  promptsApplied?: ReadonlyArray<string>;
  playbookActive?: boolean;
  model?: string;
  generationOk?: boolean;
  generationWarning?: string | null;
  language?: string;
}

function buildEmailPipeline(args: BuildPipelineArgs): EmailPipelineStage[] {
  const {
    partner, tone, hasContact, contactEmailMissing,
    kbCount = 0, promptsApplied = [], playbookActive = false,
    model, generationOk, generationWarning, language = "it",
  } = args;

  // 1) Oracolo
  let oracoloStatus: EmailPipelineStage["status"] = partner ? "ok" : "failed";
  let oracoloDetail: string | undefined;
  let oracoloTooltip = partner ? `${partner.company_name} risolto dal CRM` : "Partner non risolto";
  if (partner?.lead_status === "blacklisted") {
    oracoloStatus = "failed";
    oracoloDetail = "blacklist";
    oracoloTooltip = `Partner in blacklist${partner.status_reason ? `: ${partner.status_reason}` : ""}`;
  } else if (partner?.lead_status === "holding") {
    oracoloStatus = "warn";
    oracoloDetail = "holding";
    oracoloTooltip = "Holding pattern attivo";
  } else if (partner?.lead_status === "archived") {
    oracoloStatus = "warn";
    oracoloDetail = "archived";
  } else if (contactEmailMissing) {
    oracoloStatus = "warn";
    oracoloDetail = "no email";
    oracoloTooltip = "Partner trovato ma senza email contatto";
  } else if (!hasContact && partner) {
    oracoloDetail = "no contact";
    oracoloTooltip = "Nessun contatto censito, uso destinatario generico";
  }

  // 2) Architetto (KB + playbook + contesto)
  const architettoStatus: EmailPipelineStage["status"] = kbCount > 0 || playbookActive ? "ok" : "skipped";
  const architettoDetail =
    kbCount > 0
      ? `KB·${kbCount}${playbookActive ? " + playbook" : ""}`
      : playbookActive ? "playbook" : "—";

  // 3) Prompt Lab
  const promptStatus: EmailPipelineStage["status"] = promptsApplied.length > 0 ? "ok" : "skipped";
  const promptDetail = promptsApplied.length > 0 ? `${promptsApplied.length}` : "—";
  const promptTooltip = promptsApplied.length > 0
    ? `Prompt operativi applicati:\n• ${promptsApplied.join("\n• ")}`
    : "Nessun prompt operativo aggiuntivo";

  // 4) Giornalista (editorial review obbligatorio in generate-email)
  let giornalistaStatus: EmailPipelineStage["status"] = "skipped";
  let giornalistaDetail: string | undefined;
  let giornalistaTooltip = "Editorial review eseguito da generate-email";
  if (generationOk === true) {
    giornalistaStatus = "ok";
    giornalistaDetail = "review ok";
  } else if (generationOk === false) {
    giornalistaStatus = "failed";
    giornalistaDetail = "fail";
    giornalistaTooltip = generationWarning ?? "Generazione/review fallita";
  }

  // 5) Bozza pronta (modello + tono + lingua)
  let bozzaStatus: EmailPipelineStage["status"] = "skipped";
  let bozzaDetail: string | undefined;
  if (generationOk === true) {
    bozzaStatus = "ok";
    bozzaDetail = `${toneLabel(tone)} · ${language}`;
  } else if (generationOk === false) {
    bozzaStatus = "failed";
    bozzaDetail = "—";
  }
  const bozzaTooltip = model ? `Modello: ${model} · tono: ${toneLabel(tone)}` : `Tono: ${toneLabel(tone)}`;

  return [
    { id: "oracolo",     label: "Oracolo",     status: oracoloStatus,     detail: oracoloDetail, tooltip: oracoloTooltip },
    { id: "architetto",  label: "Architetto",  status: architettoStatus,  detail: architettoDetail,
      tooltip: kbCount > 0 ? `${kbCount} sezioni KB consultate${playbookActive ? " + playbook attivo" : ""}` : "Nessuna sezione KB" },
    { id: "prompt-lab",  label: "Prompt Lab",  status: promptStatus,      detail: promptDetail,    tooltip: promptTooltip },
    { id: "giornalista", label: "Giornalista", status: giornalistaStatus, detail: giornalistaDetail, tooltip: giornalistaTooltip },
    { id: "bozza",       label: "Bozza",       status: bozzaStatus,       detail: bozzaDetail,     tooltip: bozzaTooltip },
  ];
}
import {
  getLastComposerContext,
  isRegenerateIntent,
  setLastComposerContext,
} from "../lib/composerContext";
import {
  getLastQueryResultContext,
  isProceedIntent,
} from "../lib/lastQueryResultContext";

/**
 * compose-email tool — risolve partner/contatto nel CRM e usa la pipeline
 * ufficiale `generate-email` (Oracolo + Architetto + Prompt Lab + Giornalista).
 * NON usa più `unified-assistant` come scorciatoia.
 */

interface PartnerRow {
  id: string;
  company_name: string;
  company_alias: string | null;
  country_code: string | null;
  city: string | null;
  email: string | null;
  website: string | null;
  lead_status: string | null;
  status_reason: string | null;
  last_interaction_at: string | null;
}

interface ContactRow {
  id: string;
  partner_id: string;
  name: string | null;
  contact_alias: string | null;
  email: string | null;
  title: string | null;
}

function extractPersonAndCompany(prompt: string): { person: string | null; company: string | null; email: string | null } {
  const emailMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const email = emailMatch ? emailMatch[0] : null;

  // Pattern: "a <Persona> di/della <Azienda>"
  // Cattura nome persona (1-3 token Capitalized) e azienda (fino a "di Città" / fine)
  const re = /\ba\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,3})\s+(?:di|della|del|dello|dalla|presso)\s+(?:la\s+|il\s+|lo\s+)?([A-ZÀ-Ý][\w\sÀ-ÿ'&.-]{2,60}?)(?:\s+(?:di|in|a)\s+[A-ZÀ-Ý]|[,.\n]|$)/i;
  const m = prompt.match(re);
  let person: string | null = null;
  let company: string | null = null;
  if (m) {
    person = m[1].trim();
    company = m[2].trim().replace(/\s+(e|ed)\s+invitalo.*$/i, "").trim();
  } else {
    // Fallback: cerca azienda dopo "di/della"
    const cm = prompt.match(/\b(?:di|della|del)\s+(?:la\s+|il\s+)?([A-ZÀ-Ý][\w\sÀ-ÿ'&.-]{2,60}?)(?:\s+(?:di|in|a)\s+[A-ZÀ-Ý]|[,.\n]|$)/);
    if (cm) company = cm[1].trim();
    const pm = prompt.match(/\ba\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,2})\b/);
    if (pm) person = pm[1].trim();
  }
  return { person, company, email };
}

/* ─── Country detection (batch country-wide email) ─────────────────────── */

const COUNTRY_MAP: Record<string, string> = {
  malta: "MT", italia: "IT", italy: "IT", francia: "FR", france: "FR",
  spagna: "ES", spain: "ES", germania: "DE", germany: "DE",
  "regno unito": "GB", uk: "GB", "united kingdom": "GB", inghilterra: "GB",
  olanda: "NL", "paesi bassi": "NL", netherlands: "NL", belgio: "BE", belgium: "BE",
  portogallo: "PT", portugal: "PT", grecia: "GR", greece: "GR",
  svizzera: "CH", switzerland: "CH", austria: "AT",
  polonia: "PL", poland: "PL", romania: "RO", turchia: "TR", turkey: "TR",
  "stati uniti": "US", usa: "US", "united states": "US", america: "US",
  canada: "CA", messico: "MX", mexico: "MX", brasile: "BR", brazil: "BR",
  argentina: "AR", cile: "CL", chile: "CL", venezuela: "VE",
  cina: "CN", china: "CN", giappone: "JP", japan: "JP", india: "IN",
  emirati: "AE", uae: "AE", "arabia saudita": "SA", egitto: "EG", egypt: "EG",
  marocco: "MA", morocco: "MA", "sud africa": "ZA", "south africa": "ZA",
  australia: "AU", "nuova zelanda": "NZ", "new zealand": "NZ",
  singapore: "SG", "hong kong": "HK", thailandia: "TH", thailand: "TH",
  vietnam: "VN", indonesia: "ID", malesia: "MY", malaysia: "MY",
  filippine: "PH", philippines: "PH", korea: "KR", "corea del sud": "KR",
};

function detectCountryCode(prompt: string): { code: string; label: string } | null {
  const lower = prompt.toLowerCase();
  // Cerca pattern "partner(s) (di|in|a) <paese>" o solo nome paese standalone
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    const re = new RegExp(`\\b(?:di|in|a|da|of|from|to)\\s+${name}\\b`, "i");
    if (re.test(lower)) return { code, label: name };
  }
  // Fallback: nome paese senza preposizione (es. "partner Malta")
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(lower)) return { code, label: name };
  }
  return null;
}

function isCountryWideIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  // "tutti i partner", "ai partner di X", "ai responsabili di X", "ai nostri partner"
  return /\b(tutti\s+i\s+(?:nostri\s+)?partner|ai\s+(?:nostri\s+)?partner|ai\s+responsabili|partner\s+di\s+\w+)\b/i.test(lower);
}

async function searchPartnersByCountry(countryCode: string): Promise<PartnerRow[]> {
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city, email, website, lead_status, status_reason, last_interaction_at")
    .eq("country_code", countryCode)
    .eq("is_active", true)
    .neq("lead_status", "blacklisted")
    .order("company_name")
    .limit(50);
  if (error) return [];
  return (data ?? []) as PartnerRow[];
}

async function fetchPartnersByIds(ids: ReadonlyArray<string>): Promise<PartnerRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city, email, website, lead_status, status_reason, last_interaction_at")
    .in("id", ids as string[])
    .eq("is_active", true)
    .neq("lead_status", "blacklisted");
  if (error) return [];
  return (data ?? []) as PartnerRow[];
}

async function searchPartner(company: string | null, email: string | null): Promise<PartnerRow[]> {
  let q = supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city, email, website, lead_status, status_reason, last_interaction_at")
    .limit(5);
  if (email) {
    q = q.eq("email", email);
  } else if (company) {
    q = q.or(`company_name.ilike.%${company}%,company_alias.ilike.%${company}%`);
  } else {
    return [];
  }
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as PartnerRow[];
}

async function findContact(partnerId: string, person: string | null, email: string | null): Promise<ContactRow | null> {
  let q = supabase
    .from("partner_contacts")
    .select("id, partner_id, name, contact_alias, email, title")
    .eq("partner_id", partnerId)
    .limit(5);
  if (email) q = q.eq("email", email);
  const { data } = await q;
  const rows = (data ?? []) as ContactRow[];
  if (rows.length === 0) return null;
  if (!person) return rows[0];
  const norm = person.toLowerCase();
  return (
    rows.find((r) => (r.name ?? "").toLowerCase().includes(norm) || (r.contact_alias ?? "").toLowerCase().includes(norm)) ??
    rows[0]
  );
}

function leadStatusNote(s: string | null): string {
  if (!s) return "Lead status: non impostato";
  const map: Record<string, string> = {
    new: "Lead nuovo, mai contattato",
    contacted: "Già contattato in precedenza",
    qualified: "Lead qualificato",
    holding: "⚠️ In circuito d'attesa — verificare prima di rinviare",
    archived: "⚠️ Archiviato — invio sconsigliato",
    blacklisted: "⛔ In blacklist — invio bloccato",
    customer: "Cliente attivo",
  };
  return map[s] ?? `Lead status: ${s}`;
}

/* ─── Batch draft generation (1 chiamata generate-email per partner) ───── */

/** Cap di sicurezza per evitare costi imprevisti mantenendo il caso operativo "20 lettere". */
const MAX_BATCH_DRAFTS = 20;

async function fetchPrimaryContact(partnerId: string): Promise<{ name: string | null; email: string | null }> {
  const { data } = await supabase
    .from("partner_contacts")
    .select("name, contact_alias, email")
    .eq("partner_id", partnerId)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const row = (data ?? [])[0] as { name: string | null; contact_alias: string | null; email: string | null } | undefined;
  if (!row) return { name: null, email: null };
  return { name: row.name ?? row.contact_alias ?? null, email: row.email ?? null };
}

async function generateOneDraft(
  partner: PartnerRow,
  tone: DetectedTone,
  goal: string,
): Promise<ComposerDraft> {
  const contact = await fetchPrimaryContact(partner.id);
  const recipientEmail = contact.email ?? partner.email ?? "";
  const recipientName = contact.name;
  if (!recipientEmail) {
    return {
      partnerId: partner.id,
      partnerName: partner.company_name,
      contactName: recipientName,
      contactEmail: "",
      subject: "",
      body: "",
      status: "no_email",
      errorMessage: "Nessuna email valida per questo partner",
      pipeline: buildEmailPipeline({
        partner,
        tone,
        hasContact: !!contact.name || !!contact.email,
        contactEmailMissing: true,
      }),
    };
  }
  try {
    const gen = await invokeEdge<{
      subject?: string;
      body?: string;
      message?: string;
      error?: string;
      _context_summary?: {
        operative_prompts_applied?: string[];
        model?: string;
        kb_sections?: string[];
        playbook_active?: boolean;
      };
    }>(
      "generate-email",
      {
        body: {
          standalone: true,
          partner_id: partner.id,
          recipient_name: recipientName,
          recipient_company: partner.company_name,
          recipient_countries: partner.country_code ?? "",
          oracle_type: "primo_contatto",
          oracle_tone: tone,
          goal,
          quality: "standard",
          use_kb: true,
          language: "it",
        },
        context: "command:compose-email-batch-draft",
      },
    );
    const cs = gen?._context_summary;
    const pipeline = buildEmailPipeline({
      partner,
      tone,
      hasContact: !!contact.name || !!contact.email,
      kbCount: cs?.kb_sections?.length ?? 0,
      promptsApplied: cs?.operative_prompts_applied ?? [],
      playbookActive: !!cs?.playbook_active,
      model: cs?.model,
      generationOk: !!gen?.body,
      generationWarning: gen?.body ? null : (gen?.message ?? gen?.error ?? null),
    });
    if (!gen?.body) {
      return {
        partnerId: partner.id,
        partnerName: partner.company_name,
        contactName: recipientName,
        contactEmail: recipientEmail,
        subject: gen?.subject ?? "",
        body: "",
        status: "ai_error",
        errorMessage: gen?.message ?? gen?.error ?? "Generazione AI fallita",
        pipeline,
      };
    }
    return {
      partnerId: partner.id,
      partnerName: partner.company_name,
      contactName: recipientName,
      contactEmail: recipientEmail,
      subject: gen.subject ?? "",
      body: gen.body,
      status: "ok",
      pipeline,
    };
  } catch (e) {
    return {
      partnerId: partner.id,
      partnerName: partner.company_name,
      contactName: recipientName,
      contactEmail: recipientEmail,
      subject: "",
      body: "",
      status: "ai_error",
      errorMessage: e instanceof Error ? e.message : "Errore generazione",
      pipeline: buildEmailPipeline({
        partner,
        tone,
        hasContact: !!contact.name || !!contact.email,
        generationOk: false,
        generationWarning: e instanceof Error ? e.message : "Errore generazione",
      }),
    };
  }
}

async function generateDraftsBatch(
  partners: ReadonlyArray<PartnerRow>,
  tone: DetectedTone,
  goal: string,
): Promise<ComposerDraft[]> {
  const capped = partners.slice(0, MAX_BATCH_DRAFTS);
  const settled = await Promise.allSettled(capped.map((p) => generateOneDraft(p, tone, goal)));
  const out: ComposerDraft[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      out.push(r.value);
    } else {
      const p = capped[i];
      out.push({
        partnerId: p.id,
        partnerName: p.company_name,
        contactName: null,
        contactEmail: p.email ?? "",
        subject: "",
        body: "",
        status: "ai_error",
        errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }
  return out;
}

function buildBatchComposerResult(args: {
  partners: ReadonlyArray<PartnerRow>;
  drafts: ReadonlyArray<ComposerDraft>;
  tone: DetectedTone;
  countryCode: string;
  countryLabel: string;
  prompt: string;
}): ToolResult {
  const { partners, drafts, tone, countryCode, countryLabel, prompt } = args;
  const okDrafts = drafts.filter((d) => d.status === "ok");
  const first = okDrafts[0] ?? drafts[0];
  const recipientLines = drafts
    .slice(0, 30)
    .map((d, i) => {
      const tag =
        d.status === "ok" ? "✓" : d.status === "no_email" ? "⚠️ no email" : "✗ AI fail";
      return `${i + 1}. **${d.partnerName}** · ${tag}${d.contactEmail ? ` · ${d.contactEmail}` : ""}`;
    })
    .join("\n");

  const notes = [
    `${drafts.length} bozze generate (${okDrafts.length} pronte all'invio).`,
    `Tono applicato: ${toneLabel(tone)}.`,
    drafts.length - okDrafts.length > 0
      ? `${drafts.length - okDrafts.length} partner senza email o con errore generazione — verifica prima di inviare.`
      : "Tutte le bozze sono complete e pronte.",
    "Sfoglia con le frecce nel composer; ogni bozza è personalizzata col nome reale del contatto.",
    "",
    "Destinatari (max 30 mostrati):",
    recipientLines,
  ];

  return {
    kind: "composer",
    title: `Email batch · ${drafts.length} partner in ${countryLabel.toUpperCase()}`,
    meta: {
      count: drafts.length,
      sourceLabel: `Edge · generate-email · batch ${countryCode} · tono ${tone}`,
    },
    initialTo: first?.contactEmail ?? "",
    initialSubject: first?.subject ?? "",
    initialBody: first?.body ?? "",
    promptHint: prompt,
    partnerId: first?.partnerId ?? null,
    recipientName: first?.contactName ?? null,
    emailType: "primo_contatto",
    drafts,
    detectedTone: tone,
    countryCode,
    pipeline: first?.pipeline,
    dossier: {
      partnerName: `${partners.length} partner · ${countryLabel.toUpperCase()}`,
      contactName: null,
      leadStatus: null,
      lastInteraction: null,
      notes,
      emailType: "primo_contatto",
    },
  };
}

function daysSince(iso: string | null): string {
  if (!iso) return "mai";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "oggi";
  if (d === 1) return "ieri";
  return `${d} giorni fa`;
}

/** True se il prompt è un invito/azione generica senza identificazione esplicita
 *  di azienda+persona (es. "prepara un invito a venire a Milano"). */
function looksLikeGenericInvite(prompt: string): boolean {
  const p = (prompt ?? "").toLowerCase();
  if (!/\b(invito|invita|invitarli|ospiti|venire|partita|evento|magazzin|presentazione|cena|workshop|meeting)\b/i.test(p)) {
    return false;
  }
  // Se c'è "a <Persona> di <Azienda>" puntuale, lascia passare
  if (/\ba\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,3}\s+(?:di|della|del|dello|dalla|presso)\s+[A-ZÀ-Ý]/i.test(prompt)) {
    return false;
  }
  return true;
}

/** Estrae il testo naturale da un prompt che può essere JSON serializzato
 *  (planRunner) o testo libero. Se context.originalPrompt esiste, vince. */
function resolveNaturalPrompt(
  prompt: string,
  context?: { originalPrompt?: string },
): string {
  const orig = (context?.originalPrompt ?? "").trim();
  if (orig.length > 0) return orig;
  const trimmed = (prompt ?? "").trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const hint =
        (obj.prompt as string) ??
        (obj.goal as string) ??
        (obj.message as string) ??
        (obj.text as string) ??
        "";
      if (typeof hint === "string" && hint.length > 0) return hint;
    } catch {
      /* keep raw */
    }
  }
  return prompt;
}

/** Riesegue una query partners usando i filtri salvati nel contesto
 *  (es. city=Amman). Usato dal ramo proceed-with-context come fallback
 *  quando partnerIds non è disponibile. */
async function fetchPartnersByFilters(
  filters: ReadonlyArray<{ column: string; op: string; value: unknown }>,
): Promise<PartnerRow[]> {
  if (!filters.length) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city, email, website, lead_status, status_reason, last_interaction_at")
    .eq("is_active", true)
    .neq("lead_status", "blacklisted")
    .limit(50);
  for (const f of filters) {
    switch (f.op) {
      case "eq":
        q = q.eq(f.column, f.value);
        break;
      case "neq":
        q = q.neq(f.column, f.value);
        break;
      case "ilike":
        q = q.ilike(f.column, `%${String(f.value).replace(/%/g, "")}%`);
        break;
      case "in":
        if (Array.isArray(f.value)) q = q.in(f.column, f.value as (string | number)[]);
        break;
      case "is":
        q = q.is(f.column, f.value as null | boolean);
        break;
      // gt/gte/lt/lte non utili per il fallback compose
    }
  }
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as PartnerRow[];
}

function extractPartnersFromContextPayload(
  payload: Record<string, unknown> | undefined,
): { countryCode: string | null; partnerIds: string[] } {
  if (!payload) return { countryCode: null, partnerIds: [] };
  const partnerIdsRaw = payload.partner_ids ?? payload.partnerIds ?? payload.ids;
  const partnerIds = Array.isArray(partnerIdsRaw)
    ? partnerIdsRaw.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  const countryRaw = payload.country_code ?? payload.countryCode;
  return {
    countryCode: typeof countryRaw === "string" && countryRaw.length > 0 ? countryRaw : null,
    partnerIds,
  };
}

export const composeEmailTool: Tool = {
  id: "compose-email",
  label: "Componi email",
  description: "Risolve partner/contatto, consulta Oracolo+Architetto e prepara la bozza con la pipeline ufficiale.",

  match(prompt: string): boolean {
    const p = prompt.toLowerCase();
    if (/(?:scrivi|componi|invia|prepara|manda).*(?:e-?mail|mail)|\bbozz[ae].*(?:e-?mail|mail)|\bemail\s+a\s|draft.*email/.test(p)) {
      return true;
    }
    // Follow-up rigenerazione: "rifai", "fammele vedere nel canvas", "non vedo le nuove versioni"…
    if (isRegenerateIntent(prompt) && getLastComposerContext() !== null) {
      return true;
    }
    // Follow-up "vai avanti / procedi / prepara la bozza" subito dopo una
    // ricerca partner (Query Planner) → eredita la lista partner.
    if (isProceedIntent(prompt) && getLastQueryResultContext() !== null) {
      return true;
    }
    return false;
  },

  async execute(prompt: string, context): Promise<ToolResult> {
    // Normalizza il prompt: se planRunner ha serializzato JSON, prendi il
    // testo naturale; se c'è originalPrompt nel context, ha priorità assoluta.
    prompt = resolveNaturalPrompt(prompt, context);
    const payloadSelection = extractPartnersFromContextPayload(context?.payload);
    // ── 0a) Follow-up: rigenerazione/rivisualizzazione bozze precedenti ──
    // Esempi: "rifai più amichevole", "fammele vedere nel canvas",
    //         "non vedo le nuove versioni", "riscrivi più breve".
    // Eredita country + partner dal contesto, applica il NUOVO tono detectato.
    const lastCtx = getLastComposerContext();
    if (lastCtx && isRegenerateIntent(prompt)) {
      const tone = detectTone(prompt);
      const partners = await fetchPartnersByIds(lastCtx.partnerIds);
      if (partners.length === 0) {
        return {
          kind: "report",
          title: "Bozze precedenti non più disponibili",
          meta: { count: 0, sourceLabel: "DB · partners" },
          sections: [
            {
              heading: "Contesto perso",
              body: `I partner del batch precedente non sono più recuperabili. Riformula la richiesta indicando di nuovo il paese (es. "scrivi una mail amichevole ai partner di ${lastCtx.countryLabel}").`,
            },
          ],
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
        partners,
        drafts,
        tone,
        countryCode: lastCtx.countryCode,
        countryLabel: lastCtx.countryLabel,
        prompt,
      });
    }

    // ── 0b) Proceed-with-context: l'utente conferma ("vai avanti…") subito
    // dopo una ricerca Query Planner che ha restituito partner. Eredita la
    // lista partnerIds e genera il batch usando il prompt corrente come goal.
    const queryCtx = getLastQueryResultContext();
    if ((queryCtx || payloadSelection.partnerIds.length > 0 || payloadSelection.countryCode) && isProceedIntent(prompt)) {
      let partners: PartnerRow[] = [];
      // PRIORITÀ AL BATCH: se il prompt è esplicitamente batch ("tutti i partner",
      // "in batch", "per ciascuno") oppure la query precedente ha più partner,
      // ignoriamo un eventuale partner_id singolo iniettato dall'AI e usiamo
      // l'intera selezione (queryCtx.partnerIds o filtri).
      const batchIntent = /\b(tutti|batch|ciascuno|ognuno|per\s+ogni|in\s+blocco|massivo|massiva)\b/i.test(prompt);
      const queryHasMany = (queryCtx?.partnerIds.length ?? 0) > 1 || (queryCtx?.count ?? 0) > 1;
      const forceBatch = batchIntent || queryHasMany;
      if (forceBatch && queryCtx?.partnerIds.length) {
        partners = await fetchPartnersByIds(queryCtx.partnerIds);
      } else if (forceBatch && queryCtx?.filters && queryCtx.filters.length > 0) {
        partners = await fetchPartnersByFilters(queryCtx.filters);
      } else if (forceBatch && queryCtx?.countryCode) {
        partners = await searchPartnersByCountry(queryCtx.countryCode);
      } else if (payloadSelection.partnerIds.length > 0) {
        partners = await fetchPartnersByIds(payloadSelection.partnerIds);
      } else if (queryCtx?.partnerIds.length) {
        partners = await fetchPartnersByIds(queryCtx.partnerIds);
      } else if (payloadSelection.countryCode) {
        partners = await searchPartnersByCountry(payloadSelection.countryCode);
      } else if (queryCtx?.filters && queryCtx.filters.length > 0) {
        // Rifa la query con i filtri reali (city=Amman, country_code=SA, …)
        partners = await fetchPartnersByFilters(queryCtx.filters);
      } else if (queryCtx?.countryCode) {
        partners = await searchPartnersByCountry(queryCtx.countryCode);
      }
      if (partners.length === 0) {
        return {
          kind: "report",
          title: "Lista partner non più disponibile",
          meta: { count: 0, sourceLabel: "DB · partners" },
          sections: [
            {
              heading: "Contesto perso",
              body: `I partner trovati nella ricerca precedente non sono più recuperabili. Riformula la ricerca${queryCtx?.selectionLabel ? ` (selezione precedente: "${queryCtx.selectionLabel}")` : queryCtx?.countryLabel ? ` (es. "trovami i partner di ${queryCtx.countryLabel}")` : ""}.`,
            },
          ],
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
        partners,
        drafts,
        tone,
        countryCode: codeForCtx,
        countryLabel: labelForCtx,
        prompt,
      });
    }

    // ── 0) Country-wide batch intent ──
    // Es. "scrivi una mail di presentazione ai partner di Malta",
    //     "invitiamo tutti i partner di Italia ai nostri magazzini"
    // In questo caso NON cerchiamo una singola azienda: generiamo UNA bozza
    // pre-personalizzata per ciascun partner (Promise.allSettled, cap 12),
    // sfogliabili nel Canvas con frecce.
    const country = detectCountryCode(prompt);
    if (country && isCountryWideIntent(prompt)) {
      const partners = await searchPartnersByCountry(country.code);
      if (partners.length === 0) {
        return {
          kind: "report",
          title: `Nessun partner in ${country.label.toUpperCase()}`,
          meta: { count: 0, sourceLabel: "DB · partners" },
          sections: [
            {
              heading: "Verifica Oracolo",
              body: `Non ho trovato partner attivi in ${country.label} (${country.code}). Controlla il filtro paese o importa prima i contatti.`,
            },
          ],
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
        partners,
        drafts,
        tone,
        countryCode: country.code,
        countryLabel: country.label,
        prompt,
      });
    }

    const { person, company, email } = extractPersonAndCompany(prompt);

    // Guardrail anti-falso partner: se il prompt sembra un invito/azione
    // generica (calcio, evento, magazzino, ospiti…) e NON contiene una vera
    // identificazione di azienda + persona, rifiuta di interpretare frammenti
    // come ragione sociale (es. "calcio", "magazzini").
    if (looksLikeGenericInvite(prompt) && !email) {
      return {
        kind: "report",
        title: "Selezione destinatari mancante",
        meta: { count: 0, sourceLabel: "DB · partners" },
        sections: [
          {
            heading: "Conferma necessaria",
            body: `Il messaggio è un invito generico ma non ho una **selezione partner attiva** né un destinatario esplicito.\n\nFai prima una ricerca (es. "trovami i partner di Malta" o "elenca i partner ad Amman") e poi conferma con "prepara invito a tutti".`,
          },
        ],
      };
    }

    // 1) Cerca partner
    const candidates = await searchPartner(company, email);

    // Caso: nessun partner trovato → blocca, non aprire composer
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
        sections: [
          {
            heading: "Verifica Oracolo",
            body: `Non ho trovato nessun partner che corrisponda a ${reasonStr}.\n\nPrima di scrivere l'email serve identificare il destinatario nel CRM. Puoi:\n• Confermare la ragione sociale esatta (es. "Transport Management Srl")\n• Fornire il dominio email del destinatario\n• Censire prima il partner con "aggiungi partner ${company ?? "..."}".`,
          },
        ],
      };
    }

    // Caso: più candidati → chiedi disambiguazione
    if (candidates.length > 1 && !email) {
      const list = candidates
        .map((c, i) => `${i + 1}. **${c.company_name}**${c.city ? ` — ${c.city}` : ""}${c.country_code ? ` (${c.country_code})` : ""} · status: ${c.lead_status ?? "n/d"}`)
        .join("\n");
      return {
        kind: "report",
        title: "Più partner corrispondono",
        meta: { count: candidates.length, sourceLabel: "DB · partners" },
        sections: [
          {
            heading: "Verifica Oracolo — disambiguazione",
            body: `Ho trovato ${candidates.length} partner che corrispondono a "${company}". Indicami quale prima di procedere:\n\n${list}\n\nRiformula la richiesta specificando città o nazione (es. "scrivi a ${person ?? "Luca"} di ${candidates[0].company_name} ${candidates[0].city ?? ""}").`,
          },
        ],
      };
    }

    const partner = candidates[0];

    // Guard rail: blacklisted/archived → blocca
    if (partner.lead_status === "blacklisted") {
      return {
        kind: "report",
        title: "Invio bloccato dall'Oracolo",
        meta: { count: 1, sourceLabel: "DB · partners" },
        sections: [
          {
            heading: `${partner.company_name}`,
            body: `Questo partner è in **blacklist**${partner.status_reason ? ` (motivo: ${partner.status_reason})` : ""}. Non posso preparare email per loro. Se ritieni sia un errore, rimuovi prima la blacklist dal CRM.`,
          },
        ],
      };
    }

    // 2) Cerca contatto
    const contact = await findContact(partner.id, person, email);
    const recipientName = contact?.name ?? contact?.contact_alias ?? person ?? null;
    const recipientEmail = email ?? contact?.email ?? partner.email ?? "";

    // 3) Chiama generate-email (pipeline ufficiale)
    const emailType = "primo_contatto";
    const tone = detectTone(prompt);
    let initialSubject = "";
    let initialBody = "";
    let generationWarning: string | null = null;
    let appliedPrompts: string[] = [];
    let usedModel: string | undefined;
    let kbSections: string[] = [];
    let playbookActive = false;
    try {
      const gen = await invokeEdge<{
        success?: boolean;
        subject?: string;
        body?: string;
        error?: string;
        message?: string;
        _context_summary?: {
          operative_prompts_applied?: string[];
          model?: string;
          kb_sections?: string[];
          playbook_active?: boolean;
        };
      }>("generate-email", {
        body: {
          standalone: true,
          partner_id: partner.id,
          recipient_name: recipientName,
          recipient_company: partner.company_name,
          recipient_countries: partner.country_code ?? "",
          oracle_type: emailType,
          oracle_tone: tone,
          goal: prompt,
          quality: "standard",
          use_kb: true,
          language: "it",
        },
        context: "command:compose-email",
      });
      if (gen?.subject) initialSubject = gen.subject;
      if (gen?.body) initialBody = gen.body;
      if (!gen?.body && gen?.message) generationWarning = gen.message;
      const cs = gen?._context_summary;
      if (cs) {
        appliedPrompts = cs.operative_prompts_applied ?? [];
        usedModel = cs.model;
        kbSections = cs.kb_sections ?? [];
        playbookActive = !!cs.playbook_active;
      }
    } catch (e) {
      generationWarning = e instanceof Error ? e.message : "Errore generazione";
    }

    // 4) Costruisci dossier (Oracolo)
    const notes: string[] = [];
    notes.push(leadStatusNote(partner.lead_status));
    notes.push(`Ultima interazione: ${daysSince(partner.last_interaction_at)}`);
    if (partner.lead_status === "holding") {
      notes.push("Holding Pattern attivo: il partner è in attesa di follow-up programmato. Valuta se forzare un nuovo invio.");
    }
    if (partner.lead_status === "archived") {
      notes.push(`Archiviato${partner.status_reason ? ` — motivo: ${partner.status_reason}` : ""}. Rivaluta prima di scrivere.`);
    }
    if (!contact) {
      notes.push(`Nessun contatto censito per ${partner.company_name}: la mail userà il nome generico "${recipientName ?? "destinatario"}".`);
    } else if (!contact.email && !email) {
      notes.push("Contatto trovato ma senza email: aggiungi l'indirizzo prima di inviare.");
    }
    if (generationWarning) {
      notes.push(`Generazione AI: ${generationWarning}. Puoi rigenerare o scrivere manualmente.`);
    }

    // Audit references (Prompt Lab + KB + model) per il log visibile in Command
    const auditRefs: Array<{
      kind: "operative-prompt" | "kb-section" | "model" | "playbook" | "context";
      label: string;
      value?: string;
    }> = [];
    for (const name of appliedPrompts) {
      auditRefs.push({ kind: "operative-prompt", label: name, value: "Prompt Lab" });
    }
    if (playbookActive) {
      auditRefs.push({ kind: "playbook", label: "Playbook attivo", value: "yes" });
    }
    for (const section of kbSections.slice(0, 5)) {
      auditRefs.push({ kind: "kb-section", label: section });
    }
    if (usedModel) {
      auditRefs.push({ kind: "model", label: "AI model", value: usedModel });
    }
    auditRefs.push({ kind: "context", label: "Lead status", value: partner.lead_status ?? "n/d" });
    auditRefs.push({ kind: "context", label: "Tono detectato", value: tone });
    notes.push(`Tono: ${toneLabel(tone)}.`);

    return {
      kind: "composer",
      title: `Email a ${recipientName ?? partner.company_name}`,
      meta: {
        count: 1,
        sourceLabel: "Edge · generate-email (Oracolo+Architetto+Giornalista)",
        auditRefs,
      },
      initialTo: recipientEmail,
      initialSubject,
      initialBody,
      promptHint: prompt,
      partnerId: partner.id,
      recipientName,
      emailType,
      detectedTone: tone,
      dossier: {
        partnerName: partner.company_name,
        contactName: recipientName,
        leadStatus: partner.lead_status,
        lastInteraction: partner.last_interaction_at,
        notes,
        emailType,
      },
    };
  },
};
