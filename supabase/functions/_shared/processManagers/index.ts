/**
 * processManagers/index.ts — Barrel export for all Process Managers.
 *
 * Domains migrated:
 *   1. LeadProcessManager — lifecycle dei lead (stato, transizioni)
 *   2. EmailProcessManager — classificazione, routing, bounce handling
 *
 * Roadmap: OutreachProcessManager, LearningProcessManager.
 */

export { LeadProcessManager, initLeadProcessManager } from "./leadProcessManager.ts";
export { EmailProcessManager, initEmailProcessManager } from "./emailProcessManager.ts";
