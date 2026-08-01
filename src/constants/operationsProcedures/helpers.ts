import type { OperationProcedure, ProcedureCategory } from "./types";
import { OPERATIONS_PROCEDURES } from "./index";

// ━━━ Helper Functions ━━━

/** Find procedures matching any of the given tags */
export function findProcedures(tags: string[]): OperationProcedure[] {
  const lowerTags = tags.map(t => t.toLowerCase());
  return OPERATIONS_PROCEDURES.filter(p =>
    p.tags.some(pt => lowerTags.some(lt => pt.includes(lt) || lt.includes(pt)))
  );
}

/** Get procedures by category */
export function getProceduresByCategory(category: ProcedureCategory): OperationProcedure[] {
  return OPERATIONS_PROCEDURES.filter(p => p.category === category);
}

/** Get a single procedure by ID */
export function getProcedureById(id: string): OperationProcedure | undefined {
  return OPERATIONS_PROCEDURES.find(p => p.id === id);
}

/** Serialize procedures for AI prompt injection (compact format) */
export function serializeProceduresForPrompt(): string {
  return OPERATIONS_PROCEDURES.map(p => {
    const prereqs = p.prerequisites.length > 0
      ? `\n  Prerequisiti: ${p.prerequisites.map(pr => pr.label).join("; ")}`
      : "";
    const steps = p.steps.map(s => `    ${s.order}. ${s.action} → ${s.tool || "manuale"}: ${s.detail}`).join("\n");
    const tips = p.tips.length > 0 ? `\n  Tips: ${p.tips.join(" | ")}` : "";
    return `[${p.id}] ${p.name} (${p.category})\n  ${p.description}\n  Tags: ${p.tags.join(", ")}${prereqs}\n  Steps:\n${steps}${tips}`;
  }).join("\n\n");
}
