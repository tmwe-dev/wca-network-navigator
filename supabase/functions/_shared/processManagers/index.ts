/**
 * processManagers/index.ts — Barrel export for all Process Managers.
 *
 * Currently: LeadProcessManager (primo dominio migrato).
 * Roadmap: EmailProcessManager, OutreachProcessManager, LearningProcessManager.
 */

export { LeadProcessManager, initLeadProcessManager } from "./leadProcessManager.ts";
