/**
 * React Query hooks for Deals & Pipeline Management
 * Thin wrappers around src/data/deals.ts
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "@/lib/queryKeys";
import {
  listDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  getDealsByStage,
  getDealStats,
  logDealActivity,
  getDealActivities,
  invalidateDealCache,
} from "@/data/deals";
import type { Deal, DealActivity, DealFilters, DealStats, DealStage, DealWithRelations } from "@/data/deals";

// Re-export types
export type { Deal, DealActivity, DealFilters, DealStats, DealStage, DealWithRelations };

/**
 * Get list of deals with optional filters
 */
export function useDeals(filters?: DealFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.deals.filtered(filters as Record<string, unknown>),
    queryFn: () => listDeals(user!.id, filters),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

/**
 * Get a single deal
 */
export function useDeal(id: string) {
  return useQuery({
    queryKey: queryKeys.deal(id),
    queryFn: () => getDeal(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Get deals grouped by stage
 */
export function useDealsByStage() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.deals.byStage,
    queryFn: () => getDealsByStage(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

/**
 * Get deal statistics and KPIs
 */
export function useDealStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.dealStats,
    queryFn: () => getDealStats(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

/**
 * Get activity log for a deal
 */
export function useDealActivities(dealId: string) {
  return useQuery({
    queryKey: queryKeys.dealActivities(dealId),
    queryFn: () => getDealActivities(dealId),
    enabled: !!dealId,
    staleTime: 30_000,
  });
}

/**
 * Create a new deal
 */
export function useCreateDeal() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (deal: Omit<Deal, "id" | "user_id" | "created_at" | "updated_at">) => {
      return createDeal(user!.id, deal);
    },
    onSuccess: () => {
      invalidateDealCache(qc);
    },
  });
}

/**
 * Update a deal
 */
export function useUpdateDeal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Deal> }) => {
      return updateDeal(id, updates);
    },
    onSuccess: (data) => {
      invalidateDealCache(qc, data.id);
    },
  });
}

/**
 * Delete a deal
 */
export function useDeleteDeal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDeal(id);
      return id;
    },
    onSuccess: () => {
      invalidateDealCache(qc);
    },
  });
}

/**
 * Log a deal activity
 */
export function useLogDealActivity() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      dealId,
      activityType,
      description,
      oldValue,
      newValue,
    }: {
      dealId: string;
      activityType: DealActivity["activity_type"];
      description?: string;
      oldValue?: string;
      newValue?: string;
    }) => {
      return logDealActivity(dealId, user!.id, activityType, description, oldValue, newValue);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.dealActivities(data.deal_id) });
    },
  });
}
