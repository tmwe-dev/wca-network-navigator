import type { ComposerDraft, ToolResult } from "../types";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toneLabel } from "../../lib/toneDetector";
import { buildEmailPipeline } from "./pipeline";
import { fetchPrimaryContact } from "./partnerQueries";
import type { DetectedTone, PartnerRow } from "./types";

/** Cap di sicurezza per evitare costi imprevisti mantenendo il caso operativo "20 lettere". */
export const MAX_BATCH_DRAFTS = 20;

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

export async function generateDraftsBatch(
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

export function buildBatchComposerResult(args: {
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