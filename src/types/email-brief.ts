/**
 * Email brief shared contract + pure helpers.
 *
 * Transitional types layer (strangler seam): re-exports the brief contract and
 * its pure formatter so that hooks depend on the types layer instead of
 * `@/components/email/BriefAccordion`. Includes runtime re-exports
 * (EMPTY_BRIEF, briefToText) — behaviour unchanged.
 */
export { EMPTY_BRIEF, briefToText } from "@/components/email/BriefAccordion";
export type { EmailBrief } from "@/components/email/BriefAccordion";