/**
 * Email composer shared contracts.
 *
 * Transitional types layer (strangler seam): re-exports type contracts that
 * currently live in feature components so that hooks depend on the types layer
 * instead of importing from `@/components/*` directly. Runtime behaviour is
 * unchanged — these are type-only re-exports.
 */
export type { EditAnalysis } from "@/components/email/EmailEditLearningDialog";
export type { OracleConfig } from "@/components/email/OraclePanel";
export type { OracleContextSummary } from "@/components/email/OracleContextPanel";
