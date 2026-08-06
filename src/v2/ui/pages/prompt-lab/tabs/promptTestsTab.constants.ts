/**
 * Costanti e helper puri estratti da PromptTestsTab per snellire il componente.
 * Nessuna logica UI qui — solo valori statici e factory di draft.
 */
import type { ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { createElement } from "react";
import type { PromptTestCase } from "@/data/promptTests";

export interface PromptOption {
  id: string;
  name: string;
}

export const QK_PROMPTS = ["prompt-tests", "prompts-list"] as const;
export const qkCases = (promptId: string) => ["prompt-tests", "cases", promptId] as const;
export const qkRuns = (promptId: string) => ["prompt-tests", "runs", promptId] as const;

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning dark:text-warning border-warning/30",
  info: "bg-info/15 text-info border-info/30",
};

export const STATUS_ICON: Record<string, ReactNode> = {
  passed: createElement(CheckCircle2, { className: "h-3.5 w-3.5 text-success" }),
  failed: createElement(XCircle, { className: "h-3.5 w-3.5 text-destructive" }),
  error: createElement(AlertTriangle, { className: "h-3.5 w-3.5 text-warning" }),
  skipped: createElement(AlertTriangle, {
    className: "h-3.5 w-3.5 text-muted-foreground",
  }),
};

export function emptyDraft(promptId: string): Partial<PromptTestCase> {
  return {
    prompt_id: promptId,
    name: "Nuovo test case",
    description: "",
    input_payload: {},
    expected_contains: [],
    expected_not_contains: [],
    expected_regex: null,
    severity: "warning",
    is_active: true,
    temperature: 0.3,
    model: null,
  };
}
