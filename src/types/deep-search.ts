/**
 * Deep search shared contracts.
 *
 * Transitional types layer (strangler seam): re-exports type contracts that
 * currently live in the operations DeepSearchCanvas component so that hooks
 * depend on the types layer instead of `@/components/operations/*`.
 */
export type { DeepSearchResult, DeepSearchCurrent } from "@/components/operations/DeepSearchCanvas";