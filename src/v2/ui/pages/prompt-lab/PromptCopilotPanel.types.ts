/**
 * Tipi condivisi per PromptCopilotPanel.
 * Estratti dal componente principale per snellirlo — nessuna logica.
 */
export type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  kind?: "chat" | "intake";
};

export interface KbConsulted {
  id: string;
  category: string;
  chapter: string | null;
  title: string;
}

export interface PromptProposal {
  proposed_content?: string;
  rationale?: string;
  risks?: string;
  assumptions?: string;
}

export interface KbProposal {
  suggested_category?: string | null;
  suggested_chapter?: string | null;
  suggested_title?: string | null;
  suggested_content?: string | null;
  suggested_tags?: string[];
  suggested_priority?: number;
  conflicts_with?: string[];
  duplicates_of?: string | null;
  rationale?: string | null;
}

export interface Occurrence {
  kind: "operative_prompt" | "kb_entry";
  id: string;
  label: string;
  field: string;
  excerpt: string;
}

export interface GlobalReplacement {
  source_kind: "operative_prompt" | "kb_entry";
  source_id: string;
  source_label: string;
  field: string;
  old_excerpt: string;
  new_excerpt: string;
  rationale: string;
  risk: "low" | "medium" | "high";
}

export interface GlobalProposal {
  global_replacements?: GlobalReplacement[];
  skipped?: Array<{ source_id: string; reason: string }>;
}

export interface CopilotResponse {
  reply: string;
  proposal: PromptProposal | null;
  global_proposal: GlobalProposal | null;
  occurrences: Occurrence[];
  kb_consulted: KbConsulted[];
  families_used: string[];
  intent: string;
  mode: "edit" | "global" | "diagnose";
}

export interface IntakeResponse {
  proposal: KbProposal;
}

/** Helper puro: formatta il riepilogo di una proposta KB per la chat. */
export function formatKbProposalSummary(p: KbProposal): string {
  const lines: string[] = [];
  lines.push("Ho analizzato il materiale. Ecco cosa propongo:");
  lines.push(`• Categoria: ${p.suggested_category ?? "—"} / ${p.suggested_chapter ?? "—"}`);
  lines.push(`• Titolo: ${p.suggested_title ?? "—"}`);
  if ((p.suggested_tags ?? []).length) lines.push(`• Tag: ${(p.suggested_tags ?? []).join(", ")}`);
  if (p.duplicates_of) lines.push(`⚠ Sembra un duplicato di: ${p.duplicates_of}`);
  if ((p.conflicts_with ?? []).length) lines.push(`⚠ Conflitti con: ${(p.conflicts_with ?? []).join(", ")}`);
  if (p.rationale) lines.push(`\n${p.rationale}`);
  lines.push(`\nApprova qui sotto per salvarlo come proposta KB.`);
  return lines.join("\n");
}