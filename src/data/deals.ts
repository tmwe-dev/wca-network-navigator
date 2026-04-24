/**
 * Data Access Layer — Deals & Pipeline Management
 * Single source of truth for all deals table queries.
 */
import { tFrom } from "@/lib/typedSupabase";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";

// Local interface definitions to work around missing table types
interface DealRow {
  id: string;
  user_id: string;
  partner_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  stage: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  amount: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  actual_close_date: string | null;
  lost_reason: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface DealActivityRow {
  id: string;
  deal_id: string;
  user_id: string;
  activity_type: "stage_change" | "note" | "email_sent" | "call" | "meeting" | "update";
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// ─── Types ──────────────────────────────────────────────
export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export interface Deal {
  id: string;
  user_id: string;
  partner_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  stage: DealStage;
  amount: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  actual_close_date: string | null;
  lost_reason: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  user_id: string;
  activity_type: "stage_change" | "note" | "email_sent" | "call" | "meeting" | "update";
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface DealWithRelations extends Deal {
  partner?: { company_name: string; country_code: string } | null;
  contact?: { name: string; email: string | null; mobile: string | null } | null;
}

export interface DealFilters {
  stage?: DealStage | DealStage[];
  partner_id?: string;
  contact_id?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  fromDate?: string;
  toDate?: string;
}

export interface DealStats {
  totalPipelineValue: number;
  weightedForecast: number;
  dealsByStage: { stage: DealStage; count: number; value: number; probability: number }[];
  dealsThisMonth: number;
  winRate: number;
  avgDealSize: number;
}

// ─── CRUD Operations ────────────────────────────────────

/**
 * List deals with optional filters
 */
export async function listDeals(userId: string, filters?: DealFilters): Promise<DealWithRelations[]> {
  let query = (supabase as any)
    .from("deals")
    .select(
      `
        *,
        partner:partner_id(company_name, country_code),
        contact:contact_id(name, email, mobile)
      `
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  // Apply filters
  if (filters) {
    if (filters.stage) {
      const stages = Array.isArray(filters.stage) ? filters.stage : [filters.stage];
      query = query.in("stage", stages);
    }
    if (filters.partner_id) {
      query = query.eq("partner_id", filters.partner_id);
    }
    if (filters.contact_id) {
      query = query.eq("contact_id", filters.contact_id);
    }
    if (filters.minAmount) {
      query = query.gte("amount", filters.minAmount);
    }
    if (filters.maxAmount) {
      query = query.lte("amount", filters.maxAmount);
    }
    if (filters.fromDate) {
      query = query.gte("expected_close_date", filters.fromDate);
    }
    if (filters.toDate) {
      query = query.lte("expected_close_date", filters.toDate);
    }
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as DealWithRelations[];
}

/**
 * Get a single deal with full details
 */
export async function getDeal(id: string): Promise<DealWithRelations | null> {
  const { data, error } = await (supabase as any)
    .from("deals")
    .select(
      `
        *,
        partner:partner_id(company_name, country_code),
        contact:contact_id(name, email, mobile)
      `
    )
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data as DealWithRelations | null;
}

/**
 * Create a new deal
 */
export async function createDeal(
  userId: string,
  deal: Omit<Deal, "id" | "user_id" | "created_at" | "updated_at">
): Promise<Deal> {
  const { data, error } = await (supabase as any)
    .from("deals")
    .insert([
      {
        user_id: userId,
        ...deal,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as Deal;
}

/**
 * Update a deal (auto-logs stage changes)
 */
export async function updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
  // Get current deal to detect stage changes
  const current = await getDeal(id);

  const { data, error } = await (supabase as any)
    .from("deals")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Log stage change if applicable
  if (current && updates.stage && updates.stage !== current.stage) {
    await logDealActivity(
      id,
      current.user_id,
      "stage_change",
      `Moved from ${current.stage} to ${updates.stage}`,
      current.stage,
      updates.stage
    );
  }

  return data as Deal;
}

/**
 * Delete a deal
 */
export async function deleteDeal(id: string): Promise<void> {
  const { error } = await tFrom("deals").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Get deals grouped by stage with totals
 */
export async function getDealsByStage(userId: string): Promise<Map<DealStage, { deals: Deal[]; count: number; value: number }>> {
  const deals = await listDeals(userId);

  const stages: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
  const result = new Map<DealStage, { deals: Deal[]; count: number; value: number }>();

  stages.forEach((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    result.set(stage, {
      deals: stageDeals,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
    });
  });

  return result;
}

/**
 * Get deal statistics and KPIs
 */
export async function getDealStats(userId: string): Promise<DealStats> {
  const deals = await listDeals(userId);

  // Calculate totals by stage
  const byStage: DealStats["dealsByStage"] = [];
  const stageProbabilities: Record<DealStage, number> = {
    lead: 10,
    qualified: 25,
    proposal: 50,
    negotiation: 75,
    won: 100,
    lost: 0,
  };

  const stages: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

  stages.forEach((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    const value = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const count = stageDeals.length;
    const probability = stageDeals.length > 0 ? stageDeals.reduce((sum, d) => sum + (d.probability || stageProbabilities[stage]), 0) / count : stageProbabilities[stage];

    byStage.push({
      stage,
      count,
      value,
      probability,
    });
  });

  // Calculate weighted forecast (sum of amount * probability for open deals)
  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const weightedForecast = openDeals.reduce((sum, d) => sum + (d.amount * (d.probability || 50)) / 100, 0);

  // Total pipeline value (excludes won and lost)
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Deals this month
  const thisMonth = new Date();
  thisMonth.setMonth(thisMonth.getMonth() - 1);
  const dealsThisMonth = deals.filter((d) => new Date(d.created_at) > thisMonth).length;

  // Win rate
  const wonDeals = deals.filter((d) => d.stage === "won");
  const closedDeals = deals.filter((d) => d.stage === "won" || d.stage === "lost");
  const winRate = closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : 0;

  // Average deal size
  const avgDealSize = deals.length > 0 ? deals.reduce((sum, d) => sum + (d.amount || 0), 0) / deals.length : 0;

  return {
    totalPipelineValue: Math.round(totalPipelineValue * 100) / 100,
    weightedForecast: Math.round(weightedForecast * 100) / 100,
    dealsByStage: byStage,
    dealsThisMonth,
    winRate: Math.round(winRate * 100) / 100,
    avgDealSize: Math.round(avgDealSize * 100) / 100,
  };
}

// ─── Activity Log ────────────────────────────────────────

/**
 * Log a deal activity
 */
export async function logDealActivity(
  dealId: string,
  userId: string,
  activityType: DealActivity["activity_type"],
  description?: string,
  oldValue?: string,
  newValue?: string
): Promise<DealActivity> {
  const { data, error } = await (supabase as any)
    .from("deal_activities")
    .insert([
      {
        deal_id: dealId,
        user_id: userId,
        activity_type: activityType,
        description,
        old_value: oldValue,
        new_value: newValue,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as DealActivity;
}

/**
 * Get activities for a deal
 */
export async function getDealActivities(dealId: string, limit = 50): Promise<DealActivity[]> {
  const { data, error } = await (supabase as any)
    .from("deal_activities")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as DealActivity[];
}

// ─── Cache Invalidation ──────────────────────────────────

export function invalidateDealCache(qc: QueryClient, dealId?: string): void {
  if (dealId) {
    qc.invalidateQueries({ queryKey: queryKeys.deal(dealId) });
  }
  qc.invalidateQueries({ queryKey: queryKeys.dealsList });
  qc.invalidateQueries({ queryKey: queryKeys.dealStats });
}
