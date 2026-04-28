/**
 * useDeals — DEPRECATED stub.
 * The Deals feature was removed from the UI. Calendar still imports this
 * hook for optional deal linking; we return an empty list with no DB calls.
 */
import type { Deal } from "@/data/deals";
export type {
  Deal,
  DealActivity,
  DealFilters,
  DealStats,
  DealStage,
  DealWithRelations,
} from "@/data/deals";

export function useDeals() {
  return {
    data: [] as Deal[],
    isLoading: false,
    isError: false,
    error: null as Error | null,
  };
}