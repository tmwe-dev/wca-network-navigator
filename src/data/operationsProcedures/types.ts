/**
 * Operations Procedures Knowledge Base
 * 
 * Catalogo completo di tutte le procedure operative del sistema.
 * L'AI consulta questa KB per guidare l'utente step-by-step.
 */

// ━━━ Types ━━━

export type ProcedureCategory = "outreach" | "network" | "crm" | "enrichment" | "agenda" | "system";
export type Channel = "email" | "linkedin" | "whatsapp" | "sms";

export interface PrerequisiteCheck {
  check: string;
  label: string;
  path?: string;
  tool?: string;
}

export interface ProcedureStep {
  order: number;
  action: string;
  tool: string | null;
  detail: string;
  optional?: boolean;
}

export interface OperationProcedure {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: ProcedureCategory;
  channels?: Channel[];
  prerequisites: PrerequisiteCheck[];
  steps: ProcedureStep[];
  related_pages: string[];
  ai_tools_required: string[];
  tips: string[];
}
