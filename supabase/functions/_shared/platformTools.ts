/**
 * platformTools.ts — Main orchestrator for platform tool definitions and execution.
 *
 * Single source of truth for ALL tools available to AI agents.
 * Imported by: contacts-assistant, cockpit-assistant, import-assistant, extension-brain.
 *
 * REFACTORED: This is now a thin barrel that re-exports from modular components:
 * - platformTools/platformToolDefs.ts: Tool definitions in OpenAI format
 * - platformTools/platformToolHandlers.ts: Orchestrator router for execution
 *
 * Domain-specific handlers are in platformTools/[domain]Handler.ts:
 * - partnersHandler.ts: Partners domain
 * - contactsHandler.ts: Contacts/CRM domain
 * - prospectsHandler.ts: Italian prospects
 * - activitiesHandler.ts: Activities management
 * - remindersHandler.ts: Reminders
 * - memoryHandler.ts: AI memory
 * - outreachHandler.ts: Email and outreach
 * - conversationsHandler.ts: Inbox and conversations
 * - searchHandler.ts: Directory and deep search
 * - businessCardsHandler.ts: Business cards
 * - systemHandler.ts: System operations
 * - contactManagementHandler.ts: Partner contact management
 * - agentHandler.ts: UI actions and agent management
 * - workPlansHandler.ts: Work plans
 * - aliasesHandler.ts: Alias generation
 * - deleteHandler.ts: Record deletion
 */

export { PLATFORM_TOOLS } from "./platformTools/platformToolDefs.ts";
export { executePlatformTool } from "./platformTools/platformToolHandlers.ts";
