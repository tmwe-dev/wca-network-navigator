/**
 * Re-export di helper interni di harmonizeCollector per riuso da harmonizer-v2.
 * Evita duplicazione di inferCategory / readMeta / CATEGORY_TO_TABLE.
 */

export const CATEGORY_TO_TABLE_INTERNAL: Record<string, string> = {
  doctrine: "kb_entries",
  system_doctrine: "kb_entries",
  procedure: "kb_entries",
  procedures: "kb_entries",
  marketing: "kb_entries",
  kb_entry: "kb_entries",
  agent: "agents",
  persona: "agent_personas",
  playbook: "commercial_playbooks",
  operative: "operative_prompts",
  email: "email_prompts",
  email_rule: "email_address_rules",
  system_prompt: "app_settings",
};

export function readMetaPublic(section: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.+)$`, "im"),
    new RegExp(`^${escaped}:\\s*(.+)$`, "im"),
  ];
  for (const pattern of patterns) {
    const match = section.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

export function inferCategoryPublic(title: string, body: string): string {
  const haystack = `${title}\n${body}`.toLowerCase();
  if (/\bpersona\b|tone|signature|stile/.test(haystack)) return "persona";
  if (/\bagent\b|\bagente\b|kpi|responsabilit|scope operativo|trigger/.test(haystack)) return "agent";
  if (/playbook|sequenza commerciale|cadence|outreach/.test(haystack)) return "playbook";
  if (/template email|subject:|oggetto:|email|sender|whitelist/.test(haystack)) return "email";
  if (/procedura|workflow|step-by-step|runbook|briefing|checklist operativa/.test(haystack)) return "operative";
  if (/mission|identit|company|brand|manifesto/.test(haystack)) return "system_prompt";
  return "doctrine";
}
