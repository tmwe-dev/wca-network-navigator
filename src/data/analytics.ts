/**
 * Analytics Data Layer — Functions to query analytics data from Supabase
 * Provides metrics for: emails, partners, outreach, AI usage, pipeline, activities
 */
import { supabase } from "@/integrations/supabase/client";

export interface EmailMetricsData {
  totalSent: number;
  totalReceived: number;
  openRate: number;
  responseRate: number;
  avgResponseTime: number;
}

export interface PartnerMetricsData {
  totalPartners: number;
  byLeadStatus: Record<string, number>;
  byCountry: Record<string, number>;
  enrichmentCoverage: number;
  activePartners: number;
}

export interface OutreachMetricsData {
  emailsSentPerDay: Array<{ date: string; count: number }>;
  responseRate: number;
  avgResponseTime: number;
  conversionFunnel: {
    contacted: number;
    replied: number;
    interested: number;
    meeting: number;
    deal: number;
  };
}

export interface AIUsageMetricsData {
  totalCalls: number;
  byType: Record<string, number>;
  dailyUsage: Array<{ date: string; calls: number }>;
}

export interface PipelineMetricsData {
  totalValue: number;
  byStage: Record<string, number>;
  valueByStage: Record<string, number>;
  weightedForecast: number;
  winLossRatio: number;
}

export interface ActivityTimelineItem {
  date: string;
  type: string;
  count: number;
  details: string;
}

/**
 * Get email metrics within a date range
 */
export async function getEmailMetrics(
  userId: string,
  dateRange: { from: Date; to: Date }
): Promise<EmailMetricsData> {
  try {
    const { data: activities } = await supabase
      .from("activities")
      .select("activity_type, created_at, details")
      .eq("user_id", userId)
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString());

    const { data: channels } = await supabase
      .from("channel_messages")
      .select("direction, created_at")
      .eq("user_id", userId)
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString());

    let totalSent = 0;
    let totalReceived = 0;
    let responded = 0;
    let totalWithResponse = 0;
    let totalResponseTime = 0;

    // Count sent and received
    if (channels) {
      totalSent = channels.filter((c) => c.direction === "outbound").length;
      totalReceived = channels.filter((c) => c.direction === "inbound").length;

      // Calculate response rate (inbound after outbound from same contact)
      const outboundDates = channels
        .filter((c) => c.direction === "outbound")
        .map((c) => c.created_at ?? "");

      if (outboundDates.length > 0) {
        responded = channels.filter(
          (c) => c.direction === "inbound" &&
                  outboundDates.some(od => new Date(od) < new Date(c.created_at ?? ""))
        ).length;
        totalWithResponse = outboundDates.length;
      }
    }

    const openRate = totalSent > 0 ? (totalReceived / totalSent) * 100 : 0;
    const responseRate = totalWithResponse > 0 ? (responded / totalWithResponse) * 100 : 0;
    const avgResponseTime = responded > 0 ? totalResponseTime / responded : 0;

    return {
      totalSent,
      totalReceived,
      openRate,
      responseRate,
      avgResponseTime,
    };
  } catch (error) {
    console.error("Error fetching email metrics:", error);
    return {
      totalSent: 0,
      totalReceived: 0,
      openRate: 0,
      responseRate: 0,
      avgResponseTime: 0,
    };
  }
}

/**
 * Get partner metrics
 */
export async function getPartnerMetrics(userId: string): Promise<PartnerMetricsData> {
  try {
    const { data: partners } = await supabase
      .from("partners")
      .select("lead_status, country, enrichment_score")
      .eq("user_id", userId);

    if (!partners) {
      return {
        totalPartners: 0,
        byLeadStatus: {},
        byCountry: {},
        enrichmentCoverage: 0,
        activePartners: 0,
      };
    }

    const byLeadStatus: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    let enrichedCount = 0;

    for (const p of partners) {
      // Count by lead status
      const status = p.lead_status || "unknown";
      byLeadStatus[status] = (byLeadStatus[status] || 0) + 1;

      // Count by country
      if (p.country) {
        byCountry[p.country] = (byCountry[p.country] || 0) + 1;
      }

      // Count enrichment
      if (p.enrichment_score && p.enrichment_score > 0.5) {
        enrichedCount++;
      }
    }

    const activePartners = (byLeadStatus["qualified"] || 0) + (byLeadStatus["in_progress"] || 0);

    return {
      totalPartners: partners.length,
      byLeadStatus,
      byCountry,
      enrichmentCoverage: (enrichedCount / partners.length) * 100,
      activePartners,
    };
  } catch (error) {
    console.error("Error fetching partner metrics:", error);
    return {
      totalPartners: 0,
      byLeadStatus: {},
      byCountry: {},
      enrichmentCoverage: 0,
      activePartners: 0,
    };
  }
}

/**
 * Get outreach metrics
 */
export async function getOutreachMetrics(
  userId: string,
  dateRange: { from: Date; to: Date }
): Promise<OutreachMetricsData> {
  try {
    const { data: channels } = await supabase
      .from("channel_messages")
      .select("created_at, direction")
      .eq("user_id", userId)
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString());

    const emailsSentPerDay: Record<string, number> = {};

    if (channels) {
      for (const msg of channels) {
        if (msg.direction === "outbound") {
          const date = msg.created_at.split("T")[0];
          emailsSentPerDay[date] = (emailsSentPerDay[date] || 0) + 1;
        }
      }
    }

    const emailsSentPerDayArray = Object.entries(emailsSentPerDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Simplified conversion funnel (would need more detailed data in production)
    const contacted = channels?.filter((c) => c.direction === "outbound").length || 0;
    const replied = channels?.filter((c) => c.direction === "inbound").length || 0;

    return {
      emailsSentPerDay: emailsSentPerDayArray,
      responseRate: contacted > 0 ? (replied / contacted) * 100 : 0,
      avgResponseTime: 0,
      conversionFunnel: {
        contacted,
        replied,
        interested: Math.floor(replied * 0.6),
        meeting: Math.floor(replied * 0.3),
        deal: Math.floor(replied * 0.1),
      },
    };
  } catch (error) {
    console.error("Error fetching outreach metrics:", error);
    return {
      emailsSentPerDay: [],
      responseRate: 0,
      avgResponseTime: 0,
      conversionFunnel: {
        contacted: 0,
        replied: 0,
        interested: 0,
        meeting: 0,
        deal: 0,
      },
    };
  }
}

/**
 * Get AI usage metrics
 */
export async function getAIUsageMetrics(
  userId: string,
  dateRange: { from: Date; to: Date }
): Promise<AIUsageMetricsData> {
  try {
    const { data: logs } = await supabase
      .from("supervisor_audit_log")
      .select("created_at, action")
      .eq("user_id", userId)
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString());

    const byType: Record<string, number> = {};
    const dailyUsage: Record<string, number> = {};

    if (logs) {
      for (const log of logs) {
        // Count by type
        const type = log.action || "other";
        byType[type] = (byType[type] || 0) + 1;

        // Count daily
        const date = log.created_at.split("T")[0];
        dailyUsage[date] = (dailyUsage[date] || 0) + 1;
      }
    }

    const dailyUsageArray = Object.entries(dailyUsage)
      .map(([date, calls]) => ({ date, calls }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalCalls = Object.values(byType).reduce((a, b) => a + b, 0);

    return {
      totalCalls,
      byType,
      dailyUsage: dailyUsageArray,
    };
  } catch (error) {
    console.error("Error fetching AI usage metrics:", error);
    return {
      totalCalls: 0,
      byType: {},
      dailyUsage: [],
    };
  }
}

/**
 * Get pipeline metrics
 */
export async function getPipelineMetrics(userId: string): Promise<PipelineMetricsData> {
  try {
    const { data: deals } = await supabase
      .from("deals")
      .select("stage, value")
      .eq("user_id", userId);

    if (!deals || deals.length === 0) {
      return {
        totalValue: 0,
        byStage: {},
        valueByStage: {},
        weightedForecast: 0,
        winLossRatio: 0,
      };
    }

    const byStage: Record<string, number> = {};
    const valueByStage: Record<string, number> = {};
    let totalValue = 0;
    let won = 0;
    let lost = 0;

    const stageWeights: Record<string, number> = {
      "lead": 0.1,
      "prospect": 0.25,
      "qualified": 0.5,
      "negotiation": 0.75,
      "won": 1.0,
      "lost": 0.0,
    };

    for (const deal of deals) {
      const stage = deal.stage || "unknown";
      const value = deal.value || 0;

      byStage[stage] = (byStage[stage] || 0) + 1;
      valueByStage[stage] = (valueByStage[stage] || 0) + value;
      totalValue += value;

      if (stage === "won") won++;
      else if (stage === "lost") lost++;
    }

    // Calculate weighted forecast
    let weightedForecast = 0;
    for (const [stage, value] of Object.entries(valueByStage)) {
      const weight = stageWeights[stage] || 0;
      weightedForecast += value * weight;
    }

    const winLossRatio = lost > 0 ? won / lost : won > 0 ? won : 0;

    return {
      totalValue,
      byStage,
      valueByStage,
      weightedForecast,
      winLossRatio,
    };
  } catch (error) {
    console.error("Error fetching pipeline metrics:", error);
    return {
      totalValue: 0,
      byStage: {},
      valueByStage: {},
      weightedForecast: 0,
      winLossRatio: 0,
    };
  }
}

/**
 * Get activity timeline
 */
export async function getActivityTimeline(
  userId: string,
  days: number = 30
): Promise<ActivityTimelineItem[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: activities } = await supabase
      .from("activities")
      .select("created_at, activity_type")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString());

    const timeline: Record<string, Record<string, number>> = {};

    if (activities) {
      for (const activity of activities) {
        const date = activity.created_at.split("T")[0];
        const type = activity.activity_type || "other";

        if (!timeline[date]) {
          timeline[date] = {};
        }
        timeline[date][type] = (timeline[date][type] || 0) + 1;
      }
    }

    return Object.entries(timeline)
      .map(([date, types]) => {
        const totalCount = Object.values(types).reduce((a, b) => a + b, 0);
        const topType = Object.entries(types).sort(([, a], [, b]) => b - a)[0]?.[0] || "activity";
        return {
          date,
          type: topType,
          count: totalCount,
          details: Object.entries(types)
            .map(([t, c]) => `${c} ${t}`)
            .join(", "),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error("Error fetching activity timeline:", error);
    return [];
  }
}

/**
 * Comparison data for trend calculation
 */
export async function getMetricsComparison(
  userId: string,
  current: { from: Date; to: Date },
  previous: { from: Date; to: Date }
) {
  try {
    const [currentMetrics, previousMetrics] = await Promise.all([
      getEmailMetrics(userId, current),
      getEmailMetrics(userId, previous),
    ]);

    return {
      sentTrend: {
        current: currentMetrics.totalSent,
        previous: previousMetrics.totalSent,
        change: currentMetrics.totalSent - previousMetrics.totalSent,
        changePercent:
          previousMetrics.totalSent > 0
            ? ((currentMetrics.totalSent - previousMetrics.totalSent) / previousMetrics.totalSent) * 100
            : 0,
      },
      responseTrend: {
        current: currentMetrics.responseRate,
        previous: previousMetrics.responseRate,
        change: currentMetrics.responseRate - previousMetrics.responseRate,
      },
    };
  } catch (error) {
    console.error("Error fetching metrics comparison:", error);
    return {
      sentTrend: { current: 0, previous: 0, change: 0, changePercent: 0 },
      responseTrend: { current: 0, previous: 0, change: 0 },
    };
  }
}
