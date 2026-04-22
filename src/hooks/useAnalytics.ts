/**
 * Analytics Hooks — React Query hooks for analytics data
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "@/lib/queryKeys";
import {
  getEmailMetrics,
  getPartnerMetrics,
  getOutreachMetrics,
  getAIUsageMetrics,
  getPipelineMetrics,
  getActivityTimeline,
  getMetricsComparison,
  type EmailMetricsData,
  type PartnerMetricsData,
  type OutreachMetricsData,
  type AIUsageMetricsData,
  type PipelineMetricsData,
  type ActivityTimelineItem,
} from "@/data/analytics";

/**
 * Hook for email metrics within a date range
 */
export function useEmailMetrics(dateRange: { from: Date; to: Date }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.emailMetrics(dateRange),
    queryFn: () => {
      if (!user?.id) throw new Error("User not authenticated");
      return getEmailMetrics(user.id, dateRange);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for partner metrics
 */
export function usePartnerMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.partnerMetrics(),
    queryFn: () => {
      if (!user?.id) throw new Error("User not authenticated");
      return getPartnerMetrics(user.id);
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for outreach metrics
 */
export function useOutreachMetrics(dateRange: { from: Date; to: Date }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.outreachMetrics(dateRange),
    queryFn: () => {
      if (!user?.id) throw new Error("User not authenticated");
      return getOutreachMetrics(user.id, dateRange);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for AI usage metrics
 */
export function useAIUsageMetrics(dateRange: { from: Date; to: Date }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.aiUsageMetrics(dateRange),
    queryFn: () => {
      if (!user?.id) throw new Error("User not authenticated");
      return getAIUsageMetrics(user.id, dateRange);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for pipeline metrics
 */
export function usePipelineMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.pipelineMetrics(),
    queryFn: () => {
      if (!user?.id) throw new Error("User not authenticated");
      return getPipelineMetrics(user.id);
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for activity timeline
 */
export function useActivityTimeline(days: number = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.activityTimeline(days),
    queryFn: () => {
      if (!user?.id) throw new Error("User not authenticated");
      return getActivityTimeline(user.id, days);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for metrics comparison (current vs previous period)
 */
export function useMetricsComparison(
  current: { from: Date; to: Date },
  previous: { from: Date; to: Date }
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.metricsComparison(current, previous),
    queryFn: () => {
      if (!user?.id) throw new Error("User not authenticated");
      return getMetricsComparison(user.id, current, previous);
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
