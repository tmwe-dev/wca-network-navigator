/**
 * Operations shared contracts.
 *
 * Transitional types layer (strangler seam): re-exports type contracts that
 * currently live in operations feature components so that hooks depend on the
 * types layer instead of `@/components/operations/*`. Type-only re-exports.
 */
export type { StructuredPartner } from "@/components/operations/AiResultsPanel";