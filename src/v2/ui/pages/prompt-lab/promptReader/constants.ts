import type { AgentCategory } from "@/data/agentPrompts";

export const PANEL_ORDER_KEY = "prompt-reader.panel-order";
export const COPILOT_EXPANDED_KEY = "prompt-reader.copilot-expanded";

export type PanelId = "reader" | "copilot";

export const CATEGORY_ORDER: AgentCategory[] = [
  "core", "email", "outreach", "analysis", "voice", "autonomous", "classifier",
];

export const CATEGORY_LABEL: Record<AgentCategory, string> = {
  core: "Core",
  email: "Email",
  outreach: "Outreach",
  analysis: "Analisi",
  voice: "Voice",
  autonomous: "Autonomi",
  classifier: "Classificatori",
};

export function readPanelOrder(): [PanelId, PanelId] {
  try {
    const raw = localStorage.getItem(PANEL_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((x) => x === "reader" || x === "copilot") && parsed[0] !== parsed[1]) {
        return parsed as [PanelId, PanelId];
      }
    }
  } catch { /* noop */ }
  return ["reader", "copilot"];
}

export function readExpanded(): PanelId | null {
  try {
    const raw = localStorage.getItem(COPILOT_EXPANDED_KEY);
    if (raw === "copilot" || raw === "reader") return raw;
  } catch { /* noop */ }
  return null;
}