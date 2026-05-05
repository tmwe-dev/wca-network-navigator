import type { ToolResult } from "../types";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { detectTone, toneLabel } from "../../lib/toneDetector";
import { buildEmailPipeline } from "./pipeline";
import { findContact } from "./partnerQueries";
import { daysSince, leadStatusNote } from "./promptParse";
import type { PartnerRow } from "./types";

export async function buildSingleComposerResult(args: {
  partner: PartnerRow;
  person: string | null;
  email: string | null;
  prompt: string;
}): Promise<ToolResult> {
  const { partner, person, email, prompt } = args;

  const contact = await findContact(partner.id, person, email);
  const recipientName = contact?.name ?? contact?.contact_alias ?? person ?? null;
  const recipientEmail = email ?? contact?.email ?? partner.email ?? "";

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
    pipeline: buildEmailPipeline({
      partner,
      tone,
      hasContact: !!contact,
      contactEmailMissing: !!contact && !contact.email && !email,
      kbCount: kbSections.length,
      promptsApplied: appliedPrompts,
      playbookActive,
      model: usedModel,
      generationOk: !!initialBody,
      generationWarning,
    }),
    dossier: {
      partnerName: partner.company_name,
      contactName: recipientName,
      leadStatus: partner.lead_status,
      lastInteraction: partner.last_interaction_at,
      notes,
      emailType,
    },
  };
}