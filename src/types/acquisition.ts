/**
 * Acquisition pipeline shared contracts.
 *
 * Transitional types layer (strangler seam): re-exports type contracts that
 * currently live in acquisition feature components so that hooks depend on the
 * types layer instead of `@/components/acquisition/*`. Type-only re-exports.
 */
export type { QueueItem, QueueItemStatus } from "@/components/acquisition/PartnerQueue";
export type { CanvasData, CanvasPhase, ContactSource } from "@/components/acquisition/PartnerCanvas";
export type { NetworkStats, NetworkRegression } from "@/components/acquisition/NetworkPerformanceBar";