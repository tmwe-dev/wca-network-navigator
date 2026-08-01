/**
 * KB Category Mapper — maps the legacy `category` values used in `kb_entries`
 * onto the 6 canonical families used by the harmoniser:
 *   doctrine | procedures | personas | playbooks | glossary | data-schema
 *
 * Kept deterministic & dependency-free so it can be reused from both edge
 * functions and the SPA (via mirrored copy if needed).
 */

export type KbFamily =
  | "doctrine"
  | "procedures"
  | "personas"
  | "playbooks"
  | "glossary"
  | "data-schema";

export const KB_FAMILIES: readonly KbFamily[] = [
  "doctrine",
  "procedures",
  "personas",
  "playbooks",
  "glossary",
  "data-schema",
] as const;

const STATIC_MAP: Record<string, KbFamily> = {
  // doctrine / system rules
  doctrine: "doctrine",
  system_doctrine: "doctrine",
  sales_doctrine: "doctrine",
  filosofia: "doctrine",
  regole_sistema: "doctrine",
  voice_rules: "doctrine",

  // procedures / workflows
  procedures: "procedures",
  email_management: "procedures",
  lab_architect_procedure: "procedures",
  calligrafia: "procedures",

  // personas / agent identity
  agent_doctrine: "personas",

  // playbooks / sales tactics
  playbooks: "playbooks",
  chris_voss: "playbooks",
  hook: "playbooks",
  followup: "playbooks",
  struttura_email: "playbooks",
  obiezioni: "playbooks",
  cold_outreach: "playbooks",
  negoziazione: "playbooks",
  tono: "playbooks",
  arsenale: "playbooks",
  persuasione: "playbooks",
  chiusura: "playbooks",
  errori: "playbooks",
  frasi_modello: "playbooks",
  prompt_template: "playbooks",

  // glossary / dictionary
  glossary: "glossary",

  // data schema / tools / partner fields
  "data-schema": "data-schema",
  command_tools: "data-schema",
  dati_partner: "data-schema",
};

export function mapCategoryToFamily(rawCategory: string | null | undefined): KbFamily {
  if (!rawCategory) return "doctrine";
  const key = rawCategory.toLowerCase().trim();
  return STATIC_MAP[key] ?? "doctrine";
}

/** Convenience helper: returns true when the value is one of the 6 canonical families. */
export function isCanonicalFamily(value: unknown): value is KbFamily {
  return typeof value === "string" && (KB_FAMILIES as readonly string[]).includes(value);
}