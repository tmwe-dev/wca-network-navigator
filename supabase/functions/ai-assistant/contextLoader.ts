/**
 * contextLoader.ts — Context loading orchestrator (LOVABLE-91)
 *
 * REFACTORED: Thin wrapper with backward-compatible exports.
 * Implementation split into focused modules:
 * - aiProviderResolver.ts (AI provider & credit management)
 * - contextLoaders.ts (user profile, mission history, operative prompts)
 * - kbContextLoader.ts (knowledge base with tiered loading)
 * - memoryContextLoader.ts (AI memory with RAG & message compression)
 * - emailContextLoader.ts (recent email context)
 *
 * Original file (600 lines) split into 5 focused modules, each <160 lines.
 */

// Re-export everything from sub-modules
export { resolveAiProvider, consumeCredits, type ResolvedAiProvider } from "./aiProviderResolver.ts";
export { loadUserProfile, loadMissionHistory, loadSystemDoctrine, loadOperativePrompts } from "./contextLoaders.ts";
export { loadKBContext, type ContextTags } from "./kbContextLoader.ts";
export { loadMemoryContext, compressMessages } from "./memoryContextLoader.ts";
export { loadRecentEmailContext } from "./emailContextLoader.ts";
