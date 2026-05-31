/**
 * Contacts UI shared contracts.
 *
 * Transitional types layer (strangler seam): re-exports type contracts that
 * currently live in contacts feature components so that hooks depend on the
 * types layer instead of `@/components/contacts/*`. Type-only re-exports.
 */
export type { AICommand } from "@/components/contacts/ContactAIBar";
export type { SortKey } from "@/components/contacts/contactHelpers";